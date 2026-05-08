"""
utils/groq_helper.py
All Groq API interactions:
  - Policy comparison
  - Hidden clause detection
  - Personalized recommendations
  - Q&A with RAG context
"""

import json
import re
from typing import Dict, List, Any

from groq import Groq


class GroqHelper:
    """
    Wrapper for the Groq API.
    Handles prompting, response parsing, and error recovery.
    """

    def __init__(self, api_key: str, model_name: str = "llama-3.3-70b-versatile"):
        """
        Initialise the Groq client.

        Args:
            api_key: Groq API key.
            model_name: Model to use (default: llama-3.3-70b-versatile).
        """
        self.client = Groq(api_key=api_key)
        self.model_name = model_name

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _call(self, prompt: str) -> str:
        """Send a prompt and return the text response."""
        try:
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                model=self.model_name,
                temperature=0.3,
                max_completion_tokens=4096,
            )
            return chat_completion.choices[0].message.content.strip()
        except Exception as e:
            return f"[Groq Error] {str(e)}"

    def _truncate(self, text: str, max_chars: int = 8000) -> str:
        """Truncate policy text to fit within model context window."""
        if len(text) <= max_chars:
            return text
        # Keep beginning and end (most policies have key info in both)
        half = max_chars // 2
        return text[:half] + "\n\n[...middle truncated...]\n\n" + text[-half:]

    # ── 1. Policy Comparison ──────────────────────────────────────────────────

    def compare_policies(self, policy_texts: Dict[str, str]) -> Dict[str, Any]:
        """
        Extract and compare key insurance metrics across all policies.

        Args:
            policy_texts: {policy_name: full_text}
        Returns:
            dict with keys: table (markdown), metrics (dict), summary (str), raw (str)
        """
        policy_sections = "\n\n".join([
            f"### POLICY: {name}\n{self._truncate(text, 6000)}"
            for name, text in policy_texts.items()
        ])

        policy_names_list = list(policy_texts.keys())
        header_row = "| Feature | " + " | ".join(policy_names_list) + " |"
        separator = "|---|" + "|---|" * len(policy_names_list)

        prompt = f"""
You are an expert insurance analyst. Your task is to carefully read each policy document below and extract EXACT numerical values for the following features.

{policy_sections}

MANDATORY EXTRACTION — For EVERY policy, extract these 15 features:
 1. Policy Type (e.g., Health, Motor, Personal Accident, Group)
 2. Premium Amount (annual/monthly cost in ₹ — write the exact figure)
 3. Sum Insured / Coverage Amount (in ₹)
 4. Waiting Period – General (in days/months)
 5. Waiting Period – Pre-existing Diseases (in years/months)
 6. Room Rent Limit (per day cap in ₹, or "No Limit")
 7. ICU Charges Limit (per day cap in ₹, or "No Limit")
 8. Co-payment / Co-pay % (percentage the policyholder pays)
 9. Claim Settlement Ratio (%)
10. Maternity Coverage (Yes/No + details)
11. No-Claim Bonus (% increase per claim-free year)
12. Network Hospitals (count or description)
13. Pre-existing Disease Coverage (after how many years)
14. Day Care Procedures (covered or not)
15. Key Exclusions (list top 3 exclusions, separated by semicolons)

IMPORTANT RULES:
- If a value is NOT mentioned in the document, write "Not Specified"
- Use the EXACT numbers from the document — do not make up values
- Keep each cell value SHORT (under 50 characters)

OUTPUT FORMAT — respond ONLY in this exact JSON (no markdown fences, no extra text):
{{
  "comparison_table": "{header_row}\\n{separator}\\n| Policy Type | <val> | <val> |\\n| Premium Amount | <val> | <val> |\\n| Sum Insured | <val> | <val> |\\n| Waiting Period (General) | <val> | <val> |\\n| Waiting Period (Pre-existing) | <val> | <val> |\\n| Room Rent Limit | <val> | <val> |\\n| ICU Charges Limit | <val> | <val> |\\n| Co-payment % | <val> | <val> |\\n| Claim Settlement Ratio | <val> | <val> |\\n| Maternity Coverage | <val> | <val> |\\n| No-Claim Bonus | <val> | <val> |\\n| Network Hospitals | <val> | <val> |\\n| Pre-existing Disease Coverage | <val> | <val> |\\n| Day Care Procedures | <val> | <val> |\\n| Key Exclusions | <val> | <val> |",
  "metrics": {{
    "<policy_name>": {{
      "Premium": "<exact ₹ value>",
      "Sum Insured": "<exact ₹ value>",
      "Waiting Period": "<value>",
      "Room Rent Limit": "<value>",
      "Co-pay": "<value>",
      "Claim Ratio": "<value>"
    }}
  }},
  "summary": "<3-4 paragraph detailed narrative analysis comparing all policies, highlighting strengths, weaknesses, value-for-money, and which user profiles suit each policy>",
  "winner_overall": "<best policy name for most people>",
  "winner_reason": "<2-3 sentence explanation>"
}}
"""
        raw = self._call(prompt)

        # Try to parse JSON; gracefully fall back to displaying raw text
        try:
            # Strip potential markdown fences
            clean = re.sub(r"```(?:json)?|```", "", raw).strip()
            data = json.loads(clean)
            return {
                "table": data.get("comparison_table", ""),
                "metrics": data.get("metrics", {}),
                "summary": data.get("summary", ""),
                "winner": data.get("winner_overall", ""),
                "winner_reason": data.get("winner_reason", ""),
                "raw": raw,
            }
        except json.JSONDecodeError:
            # Return raw markdown-formatted text if JSON parse fails
            return {
                "table": "",
                "metrics": {},
                "summary": raw,
                "raw": raw,
            }

    # ── 2. Hidden Clause Detection ────────────────────────────────────────────

    def detect_hidden_clauses(self, policy_texts: Dict[str, str]) -> Dict[str, List[Dict]]:
        """
        Identify risky, hidden, or misleading clauses in each policy.

        Args:
            policy_texts: {policy_name: full_text}
        Returns:
            {policy_name: [{"clause": str, "severity": str, "explanation": str}]}
        """
        results = {}

        for policy_name, text in policy_texts.items():
            prompt = f"""
You are an expert insurance lawyer specializing in consumer protection.
Analyze the following insurance policy text and identify ALL hidden, risky, or potentially harmful clauses.

POLICY: {policy_name}
TEXT:
{self._truncate(text, 8000)}

Look specifically for:
- Sub-limit clauses (room rent caps, ICU limits)
- Co-payment obligations
- Unreasonably long waiting periods
- Exclusions for common conditions
- Disease-specific sub-limits
- Fine-print conditions that reduce claim value
- Maternity exclusion conditions
- Renewal denial conditions
- Network hospital restrictions
- Pre-authorization requirements

RESPOND IN THIS EXACT JSON FORMAT:
[
  {{
    "clause": "<short clause title>",
    "severity": "high|medium|low",
    "explanation": "<plain English explanation of why this is risky for policyholders>"
  }}
]

Identify at least 5 clauses if present. Return ONLY the JSON array, no markdown fences.
"""
            raw = self._call(prompt)
            try:
                clean = re.sub(r"```(?:json)?|```", "", raw).strip()
                items = json.loads(clean)
                results[policy_name] = items if isinstance(items, list) else []
            except Exception:
                # Fallback: return raw text as a single "clause"
                results[policy_name] = [{
                    "clause": "Analysis Result",
                    "severity": "medium",
                    "explanation": raw[:500]
                }]

        return results

    # ── 3. Personalized Recommendation ───────────────────────────────────────

    def get_recommendation(self,
                           policy_texts: Dict[str, str],
                           user_profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recommend the best policy for a given user profile.

        Args:
            policy_texts: {policy_name: full_text}
            user_profile: {age, budget, family_size, pre_existing, priorities}
        Returns:
            dict with keys: recommended_policy, reason, pros, cons, alternatives
        """
        policy_summaries = "\n\n".join([
            f"=== {name} ===\n{self._truncate(text, 3000)}"
            for name, text in policy_texts.items()
        ])

        prompt = f"""
You are a certified insurance advisor. Based on the user's profile and the available insurance policies, recommend the BEST policy.

USER PROFILE:
- Age: {user_profile.get('age')} years
- Monthly Budget: ₹{user_profile.get('budget')}
- Family Size: {user_profile.get('family_size')} members
- Pre-existing Conditions: {user_profile.get('pre_existing')}
- Coverage Priorities: {', '.join(user_profile.get('priorities', []))}

AVAILABLE POLICIES:
{policy_summaries}

Analyze each policy against the user's needs and provide a recommendation.

RESPOND IN THIS EXACT JSON FORMAT:
{{
  "recommended_policy": "<exact policy name>",
  "reason": "<2–3 sentences explaining why this is the best fit>",
  "pros": [
    "<specific benefit 1 relevant to this user>",
    "<specific benefit 2>",
    "<specific benefit 3>"
  ],
  "cons": [
    "<limitation 1 the user should know>",
    "<limitation 2>"
  ],
  "alternatives": "<1 paragraph on second-best option and why someone might prefer it>",
  "fit_score": "<score out of 10>"
}}

Return ONLY the JSON object, no markdown fences.
"""
        raw = self._call(prompt)
        try:
            clean = re.sub(r"```(?:json)?|```", "", raw).strip()
            data = json.loads(clean)
            return data
        except Exception:
            return {
                "recommended_policy": "See analysis below",
                "reason": raw[:600],
                "pros": [],
                "cons": [],
                "alternatives": "",
            }

    # ── 4. RAG-based Q&A ──────────────────────────────────────────────────────

    def answer_question(self,
                        question: str,
                        context: str,
                        policy_names: List[str]) -> str:
        """
        Answer a user question using retrieved context from ChromaDB.

        Args:
            question: User's question.
            context: Relevant chunks retrieved via RAG.
            policy_names: Names of available policies.
        Returns:
            Formatted answer string.
        """
        policies_list = ", ".join(policy_names)

        prompt = f"""
You are an expert insurance advisor. Answer the following question based ONLY on the provided policy context.

AVAILABLE POLICIES: {policies_list}

RETRIEVED CONTEXT:
{context}

USER QUESTION: {question}

INSTRUCTIONS:
- Be specific and cite which policy you're referring to
- Use bullet points for comparisons
- If information is not in the context, say "This information is not clearly available in the provided policy documents"
- Keep the answer concise but complete (max 300 words)
- Format nicely with markdown
"""
        return self._call(prompt)
