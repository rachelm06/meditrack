"""
AI Judge for Healthcare Supply Chain Emergency Purchase Decisions
================================================================

CONSTITUTION AND RULEBOOK:

MISSION: Determine when emergency purchases are necessary outside normal monthly
procurement cycles to prevent critical supply shortages in healthcare settings.

CORE PRINCIPLES:
1. Patient Safety First - Never allow critical medical supplies to stockout
2. Evidence-Based Decisions - All recommendations must cite specific data trends
3. Cost-Aware but Life-Priority - Consider costs but prioritize life-saving supplies
4. Transparency - Provide clear rationale for every decision
5. Calibrated Confidence - Express appropriate uncertainty levels

EMERGENCY PURCHASE CRITERIA (Weighted Scoring System):

CRITICAL FACTORS (Must trigger if ANY met):
- Days until depletion < 3 for life-critical items (Score: EMERGENCY)
- Usage spike > 300% of normal rate for 3+ consecutive days (Score: EMERGENCY)
- Predicted shortage during weekend/holiday when suppliers unavailable (Score: EMERGENCY)

HIGH PRIORITY FACTORS (Score 0-10 each):
1. Days Until Depletion (Weight: 0.3)
   - <7 days: 10 points
   - 7-14 days: 7 points
   - 15-21 days: 4 points
   - >21 days: 0 points

2. Usage Trend Acceleration (Weight: 0.25)
   - >200% increase: 10 points
   - 150-200% increase: 7 points
   - 100-150% increase: 4 points
   - <100% increase: 0 points

3. Item Criticality Level (Weight: 0.25)
   - Life-critical (ventilators, medications): 10 points
   - Essential (PPE, surgical supplies): 7 points
   - Important (general supplies): 4 points
   - Non-critical: 1 point

4. Supplier Reliability Risk (Weight: 0.1)
   - High risk/single supplier: 8 points
   - Medium risk: 5 points
   - Low risk/multiple suppliers: 2 points

5. Seasonal/External Factors (Weight: 0.1)
   - Pandemic/emergency conditions: 10 points
   - Flu season/predictable surge: 6 points
   - Normal conditions: 0 points

DECISION THRESHOLDS:
- EMERGENCY (>8.5): Immediate purchase required within 24 hours
- URGENT (7.0-8.5): Purchase recommended within 3 days
- MODERATE (5.0-7.0): Consider accelerated purchase within 1 week
- LOW (<5.0): Continue normal procurement schedule

CONFIDENCE CALIBRATION:
- High (>90%): Clear data trends, well-established patterns
- Medium (70-90%): Some uncertainty in trends or external factors
- Low (<70%): Limited data, high uncertainty, recommend human review
"""

from typing import Dict, List, Any, Tuple
from datetime import datetime, timedelta
import json

class SupplyChainJudge:
    def __init__(self):
        self.constitution = __doc__

    def evaluate_emergency_purchase(
        self,
        item_data: Dict[str, Any],
        usage_trends: List[Dict[str, Any]],
        predictions: Dict[str, Any],
        external_context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Main evaluation function that applies the constitution rules

        Returns:
            {
                "decision": "EMERGENCY|URGENT|MODERATE|LOW",
                "score": float,
                "confidence": float,
                "rationale": str,
                "action_required": str,
                "supporting_evidence": List[str],
                "trends_analysis": Dict,
                "timeline": str
            }
        """

        # Initialize scoring
        total_score = 0.0
        evidence = []
        confidence_factors = []

        # CRITICAL FACTORS CHECK (Override system)
        critical_check = self._check_critical_factors(item_data, usage_trends, predictions)
        if critical_check["is_critical"]:
            return self._create_emergency_response(critical_check, item_data)

        # WEIGHTED SCORING SYSTEM

        # 1. Days Until Depletion (Weight: 0.3)
        depletion_score, depletion_evidence, depletion_confidence = self._score_days_until_depletion(
            item_data, predictions
        )
        total_score += depletion_score * 0.3
        evidence.extend(depletion_evidence)
        confidence_factors.append(depletion_confidence)

        # 2. Usage Trend Acceleration (Weight: 0.25)
        trend_score, trend_evidence, trend_confidence = self._score_usage_trends(usage_trends)
        total_score += trend_score * 0.25
        evidence.extend(trend_evidence)
        confidence_factors.append(trend_confidence)

        # 3. Item Criticality Level (Weight: 0.25)
        criticality_score, criticality_evidence = self._score_item_criticality(item_data)
        total_score += criticality_score * 0.25
        evidence.extend(criticality_evidence)
        confidence_factors.append(0.9)  # High confidence in criticality classification

        # 4. Supplier Reliability Risk (Weight: 0.1)
        supplier_score, supplier_evidence = self._score_supplier_risk(item_data)
        total_score += supplier_score * 0.1
        evidence.extend(supplier_evidence)
        confidence_factors.append(0.7)  # Medium confidence in supplier assessment

        # 5. Seasonal/External Factors (Weight: 0.1)
        external_score, external_evidence = self._score_external_factors(external_context)
        total_score += external_score * 0.1
        evidence.extend(external_evidence)
        confidence_factors.append(0.6)  # Lower confidence in external predictions

        # Calculate overall confidence
        overall_confidence = sum(confidence_factors) / len(confidence_factors)

        # Determine decision category
        decision = self._categorize_decision(total_score)

        # Generate rationale and action plan
        rationale = self._generate_rationale(total_score, decision, evidence)
        action_required = self._generate_action_plan(decision, item_data)
        timeline = self._generate_timeline(decision, depletion_score)

        # Trends analysis summary
        trends_analysis = self._analyze_trends(usage_trends, predictions)

        return {
            "decision": decision,
            "score": round(total_score, 2),
            "confidence": round(overall_confidence, 2),
            "rationale": rationale,
            "action_required": action_required,
            "supporting_evidence": evidence,
            "trends_analysis": trends_analysis,
            "timeline": timeline,
            "constitution_applied": True,
            "evaluation_timestamp": datetime.now().isoformat()
        }

    def _check_critical_factors(self, item_data, usage_trends, predictions):
        """Check for factors that immediately trigger emergency status"""

        # Calculate days until depletion
        current_stock = item_data.get('current_stock', 0)
        usage_rate = item_data.get('usage_rate', 0)
        days_until_depletion = current_stock / usage_rate if usage_rate > 0 else 999

        # Check critical conditions
        is_life_critical = self._is_life_critical_item(item_data['item_name'])

        if is_life_critical and days_until_depletion < 3:
            return {
                "is_critical": True,
                "reason": "Life-critical item with <3 days supply remaining",
                "evidence": [f"Only {days_until_depletion:.1f} days of {item_data['item_name']} remaining"]
            }

        # Check for usage spike
        if len(usage_trends) >= 3:
            recent_usage = [trend.get('total_usage', 0) for trend in usage_trends[-3:]]
            baseline_usage = usage_trends[0].get('total_usage', 1) if usage_trends else 1
            avg_recent = sum(recent_usage) / len(recent_usage)

            if avg_recent > baseline_usage * 3:
                return {
                    "is_critical": True,
                    "reason": "Usage spike >300% for 3+ consecutive periods",
                    "evidence": [f"Usage increased from {baseline_usage} to {avg_recent:.1f} (+{((avg_recent/baseline_usage-1)*100):.0f}%)"]
                }

        # Check weekend/holiday risk
        current_time = datetime.now()
        if current_time.weekday() >= 4 and days_until_depletion < 7:  # Friday, Saturday, Sunday
            return {
                "is_critical": True,
                "reason": "Weekend approaching with low stock and limited supplier availability",
                "evidence": [f"Weekend/holiday period with only {days_until_depletion:.1f} days supply"]
            }

        return {"is_critical": False}

    def _score_days_until_depletion(self, item_data, predictions):
        """Score based on days until stockout"""
        current_stock = item_data.get('current_stock', 0)
        usage_rate = item_data.get('usage_rate', 0)

        if usage_rate <= 0:
            return 0, ["No usage data available for depletion calculation"], 0.3

        days_until_depletion = current_stock / usage_rate

        if days_until_depletion < 7:
            score = 10
            evidence = [f"Critical: Only {days_until_depletion:.1f} days supply remaining"]
            confidence = 0.9
        elif days_until_depletion <= 14:
            score = 7
            evidence = [f"Low stock: {days_until_depletion:.1f} days supply remaining"]
            confidence = 0.8
        elif days_until_depletion <= 21:
            score = 4
            evidence = [f"Moderate stock: {days_until_depletion:.1f} days supply remaining"]
            confidence = 0.7
        else:
            score = 0
            evidence = [f"Adequate stock: {days_until_depletion:.1f} days supply remaining"]
            confidence = 0.8

        return score, evidence, confidence

    def _score_usage_trends(self, usage_trends):
        """Score based on usage trend acceleration"""
        if len(usage_trends) < 2:
            return 0, ["Insufficient usage data for trend analysis"], 0.2

        # Calculate trend over recent periods
        recent_usage = usage_trends[-1].get('total_usage', 0)
        baseline_usage = usage_trends[0].get('total_usage', 1)

        if baseline_usage == 0:
            baseline_usage = 1

        increase_ratio = recent_usage / baseline_usage
        increase_percent = (increase_ratio - 1) * 100

        if increase_ratio > 2.0:  # >200% increase
            score = 10
            evidence = [f"Sharp usage increase: +{increase_percent:.0f}% vs baseline"]
            confidence = 0.8
        elif increase_ratio > 1.5:  # 150-200% increase
            score = 7
            evidence = [f"Significant usage increase: +{increase_percent:.0f}% vs baseline"]
            confidence = 0.75
        elif increase_ratio > 1.0:  # 100-150% increase
            score = 4
            evidence = [f"Moderate usage increase: +{increase_percent:.0f}% vs baseline"]
            confidence = 0.7
        else:
            score = 0
            evidence = [f"Stable or decreasing usage: {increase_percent:+.0f}% vs baseline"]
            confidence = 0.8

        return score, evidence, confidence

    def _score_item_criticality(self, item_data):
        """Score based on how critical the item is for patient care"""
        item_name = item_data.get('item_name', '').lower()

        # Life-critical items
        life_critical_terms = [
            'ventilator', 'insulin', 'epinephrine', 'defibrillator', 'oxygen',
            'pacemaker', 'dialysis', 'blood', 'plasma', 'emergency'
        ]

        # Essential items
        essential_terms = [
            'mask', 'gloves', 'sanitizer', 'syringe', 'bandage', 'thermometer',
            'surgical', 'ppe', 'gown', 'shield'
        ]

        # Important items
        important_terms = [
            'supply', 'equipment', 'tool', 'instrument'
        ]

        if any(term in item_name for term in life_critical_terms):
            return 10, [f"Life-critical item: {item_data['item_name']} directly impacts patient survival"]
        elif any(term in item_name for term in essential_terms):
            return 7, [f"Essential item: {item_data['item_name']} required for safe patient care"]
        elif any(term in item_name for term in important_terms):
            return 4, [f"Important item: {item_data['item_name']} supports healthcare operations"]
        else:
            return 1, [f"Standard priority item: {item_data['item_name']}"]

    def _is_life_critical_item(self, item_name):
        """Determine if item is life-critical"""
        item_name = item_name.lower()
        life_critical_terms = [
            'ventilator', 'insulin', 'epinephrine', 'defibrillator', 'oxygen',
            'pacemaker', 'dialysis', 'blood', 'plasma', 'emergency'
        ]
        return any(term in item_name for term in life_critical_terms)

    def _score_supplier_risk(self, item_data):
        """Score based on supplier reliability and availability"""
        supplier = item_data.get('supplier', 'Unknown')

        # This would ideally connect to a supplier reliability database
        # For now, we'll make reasonable assumptions

        if supplier == 'Unknown' or not supplier:
            return 8, ["Unknown supplier reliability - high risk"]

        # Simulate supplier risk assessment
        if 'single' in supplier.lower() or 'exclusive' in supplier.lower():
            return 8, [f"Single supplier risk: {supplier} - limited alternatives"]
        elif 'reliable' in supplier.lower() or 'primary' in supplier.lower():
            return 2, [f"Reliable supplier: {supplier} - low risk"]
        else:
            return 5, [f"Standard supplier: {supplier} - medium risk"]

    def _score_external_factors(self, external_context):
        """Score based on external factors like pandemics, disasters, etc."""
        if not external_context:
            return 0, ["No external risk factors identified"]

        # Check for emergency conditions
        if external_context.get('pandemic_status') == 'active':
            return 10, ["Active pandemic conditions - high demand volatility"]
        elif external_context.get('flu_season') == True:
            return 6, ["Flu season - predictable increased demand"]
        elif external_context.get('emergency_declared') == True:
            return 10, ["Emergency declared - supply chain disruption risk"]

        return 0, ["Normal operating conditions"]

    def _categorize_decision(self, score):
        """Convert numerical score to decision category"""
        if score > 8.5:
            return "EMERGENCY"
        elif score >= 7.0:
            return "URGENT"
        elif score >= 5.0:
            return "MODERATE"
        else:
            return "LOW"

    def _generate_rationale(self, score, decision, evidence):
        """Generate human-readable rationale for the decision"""
        rationale = f"AI Judge Decision: {decision} (Score: {score:.1f}/10.0)\n\n"
        rationale += "Evidence-based analysis:\n"
        for i, item in enumerate(evidence, 1):
            rationale += f"{i}. {item}\n"

        rationale += f"\nConclusion: Based on healthcare supply chain constitutional rules, "

        if decision == "EMERGENCY":
            rationale += "immediate emergency purchase is required to prevent potential patient safety risk."
        elif decision == "URGENT":
            rationale += "urgent purchase is recommended to maintain adequate safety margins."
        elif decision == "MODERATE":
            rationale += "accelerated purchase should be considered to optimize inventory levels."
        else:
            rationale += "current procurement schedule appears adequate."

        return rationale

    def _generate_action_plan(self, decision, item_data):
        """Generate specific action recommendations"""
        item_name = item_data.get('item_name', 'item')

        if decision == "EMERGENCY":
            return f"IMMEDIATE ACTION: Contact emergency procurement team. Place urgent order for {item_name} within 24 hours. Consider expedited shipping or local sourcing."
        elif decision == "URGENT":
            return f"Contact procurement team within 3 days. Prioritize {item_name} in next order cycle. Review supplier lead times."
        elif decision == "MODERATE":
            return f"Include {item_name} in next weekly procurement review. Consider slightly increasing order quantity as buffer."
        else:
            return f"No immediate action required for {item_name}. Continue standard monitoring."

    def _generate_timeline(self, decision, depletion_score):
        """Generate recommended timeline for action"""
        if decision == "EMERGENCY":
            return "Within 24 hours"
        elif decision == "URGENT":
            return "Within 3 days"
        elif decision == "MODERATE":
            return "Within 1 week"
        else:
            return "Next regular procurement cycle"

    def _analyze_trends(self, usage_trends, predictions):
        """Analyze trends for reporting"""
        if not usage_trends:
            return {"trend_direction": "unknown", "volatility": "unknown"}

        recent_values = [t.get('total_usage', 0) for t in usage_trends[-5:]]

        if len(recent_values) >= 2:
            trend_direction = "increasing" if recent_values[-1] > recent_values[0] else "decreasing"
        else:
            trend_direction = "stable"

        # Simple volatility calculation
        if len(recent_values) >= 3:
            avg_val = sum(recent_values) / len(recent_values)
            variance = sum((x - avg_val) ** 2 for x in recent_values) / len(recent_values)
            volatility = "high" if variance > avg_val else "moderate" if variance > avg_val/2 else "low"
        else:
            volatility = "unknown"

        return {
            "trend_direction": trend_direction,
            "volatility": volatility,
            "recent_usage_pattern": recent_values
        }

    def _create_emergency_response(self, critical_check, item_data):
        """Create immediate emergency response for critical factors"""
        return {
            "decision": "EMERGENCY",
            "score": 10.0,
            "confidence": 0.95,
            "rationale": f"CRITICAL OVERRIDE: {critical_check['reason']}. Constitutional emergency criteria met.",
            "action_required": f"IMMEDIATE: Emergency procurement required for {item_data['item_name']} - patient safety risk identified",
            "supporting_evidence": critical_check['evidence'],
            "trends_analysis": {"emergency_override": True},
            "timeline": "IMMEDIATE - within hours",
            "constitution_applied": True,
            "evaluation_timestamp": datetime.now().isoformat()
        }

    def ask_question(self, question: str, context_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle user questions about supply chain, predictions, and dashboard data

        This is a simple rule-based system that could be enhanced with LLM integration
        """
        question_lower = question.lower()

        # Emergency/urgency related questions
        if any(word in question_lower for word in ['emergency', 'urgent', 'critical', 'shortage', 'stockout']):
            return self._handle_urgency_question(question, context_data)

        # Trend analysis questions
        elif any(word in question_lower for word in ['trend', 'pattern', 'increasing', 'decreasing', 'usage']):
            return self._handle_trend_question(question, context_data)

        # Budget/cost questions
        elif any(word in question_lower for word in ['cost', 'budget', 'expensive', 'money', 'spend']):
            return self._handle_budget_question(question, context_data)

        # Prediction questions
        elif any(word in question_lower for word in ['predict', 'forecast', 'future', 'expect']):
            return self._handle_prediction_question(question, context_data)

        # General dashboard questions
        else:
            return self._handle_general_question(question, context_data)

    def _handle_urgency_question(self, question, context_data):
        """Handle questions about urgency and emergency purchases"""
        inventory_data = context_data.get('inventory', [])

        urgent_items = []
        for item in inventory_data:
            usage_rate = item.get('usage_rate', 0)
            current_stock = item.get('current_stock', 0)

            if usage_rate > 0:
                days_remaining = current_stock / usage_rate
                if days_remaining < 14:
                    urgent_items.append({
                        'name': item.get('item_name'),
                        'days': days_remaining,
                        'criticality': self._is_life_critical_item(item.get('item_name', ''))
                    })

        if urgent_items:
            urgent_items.sort(key=lambda x: x['days'])
            response = "⚠️ **URGENT ITEMS IDENTIFIED:**\n\n"

            for item in urgent_items[:5]:  # Top 5 most urgent
                urgency = "🚨 CRITICAL" if item['criticality'] else "⚠️ URGENT"
                response += f"{urgency}: **{item['name']}** - {item['days']:.1f} days remaining\n"

            response += f"\n**Why emergency purchases may be necessary:**\n"
            response += f"• Low stock levels risk patient care disruption\n"
            response += f"• Weekend/holiday supplier availability gaps\n"
            response += f"• Lead times may exceed remaining stock duration\n"
            response += f"• Usage patterns show potential acceleration\n"
        else:
            response = "✅ **No urgent items detected.** All supplies appear to have adequate stock levels based on current usage patterns."

        return {
            "response": response,
            "confidence": 0.85,
            "response_type": "urgency_analysis",
            "actionable": len(urgent_items) > 0
        }

    def _handle_trend_question(self, question, context_data):
        """Handle questions about usage trends"""
        usage_data = context_data.get('usage_trends', [])

        if not usage_data:
            return {
                "response": "📊 I need usage trend data to analyze patterns. Please ensure usage data is available in the system.",
                "confidence": 0.9,
                "response_type": "data_needed"
            }

        response = "📈 **USAGE TREND ANALYSIS:**\n\n"

        # Analyze overall trends
        if len(usage_data) >= 2:
            recent = sum(item.get('total_usage', 0) for item in usage_data[-3:]) / 3
            baseline = sum(item.get('total_usage', 0) for item in usage_data[:3]) / 3

            change_percent = ((recent - baseline) / baseline * 100) if baseline > 0 else 0

            if change_percent > 50:
                response += f"🔴 **Sharp increase**: Usage up {change_percent:.0f}% recently\n"
                response += f"**Emergency risk**: High demand may accelerate stockouts\n\n"
            elif change_percent > 20:
                response += f"🟡 **Moderate increase**: Usage up {change_percent:.0f}% recently\n"
                response += f"**Trend suggests**: Consider increasing procurement buffer\n\n"
            elif change_percent < -20:
                response += f"🔵 **Usage decline**: Down {abs(change_percent):.0f}% recently\n"
                response += f"**Opportunity**: Potential cost savings through reduced orders\n\n"
            else:
                response += f"🟢 **Stable usage**: Relatively consistent patterns\n\n"

        response += f"**Key insights that drive emergency decisions:**\n"
        response += f"• Sudden spikes indicate potential supply crises\n"
        response += f"• Seasonal patterns help predict future demand\n"
        response += f"• Volatility requires larger safety stock buffers\n"

        return {
            "response": response,
            "confidence": 0.8,
            "response_type": "trend_analysis"
        }

    def _handle_budget_question(self, question, context_data):
        """Handle budget and cost-related questions"""
        budget_data = context_data.get('budget_impact', {})

        response = "💰 **BUDGET IMPACT ANALYSIS:**\n\n"

        total_spend = budget_data.get('total_monthly_spend', 0)
        waste_cost = budget_data.get('waste_cost', 0)
        potential_savings = budget_data.get('potential_savings', 0)

        if total_spend > 0:
            waste_percentage = (waste_cost / total_spend * 100) if total_spend > 0 else 0

            response += f"**Monthly Budget**: ${total_spend:,.2f}\n"
            response += f"**Waste Cost**: ${waste_cost:,.2f} ({waste_percentage:.1f}% of budget)\n"
            response += f"**Potential Savings**: ${potential_savings:,.2f}\n\n"

            if waste_percentage > 20:
                response += f"🔴 **High waste detected** - Emergency purchases may be justified to reduce long-term costs\n"
            elif waste_percentage > 10:
                response += f"🟡 **Moderate waste** - Optimizing purchase timing could save money\n"
            else:
                response += f"🟢 **Efficient spending** - Current procurement strategy is cost-effective\n"
        else:
            response += f"No budget data available. Upload financial data for cost analysis.\n"

        response += f"\n**Emergency purchase budget impact:**\n"
        response += f"• Short-term higher costs may prevent long-term stockout losses\n"
        response += f"• Expedited shipping costs vs. operational disruption costs\n"
        response += f"• Patient safety costs are typically unquantifiable but critical\n"

        return {
            "response": response,
            "confidence": 0.75,
            "response_type": "budget_analysis"
        }

    def _handle_prediction_question(self, question, context_data):
        """Handle prediction and forecasting questions"""
        response = "🔮 **DEMAND FORECASTING INSIGHTS:**\n\n"

        inventory_data = context_data.get('inventory', [])

        if inventory_data:
            response += f"**Based on current data patterns:**\n\n"

            for item in inventory_data[:5]:  # Top 5 items
                name = item.get('item_name', 'Unknown')
                usage_rate = item.get('usage_rate', 0)
                current_stock = item.get('current_stock', 0)

                if usage_rate > 0:
                    days_remaining = current_stock / usage_rate
                    predicted_depletion = datetime.now() + timedelta(days=days_remaining)

                    response += f"**{name}**: Predicted depletion {predicted_depletion.strftime('%B %d, %Y')}\n"

                    if days_remaining < 7:
                        response += f"  🚨 **Emergency action needed** - Less than 1 week remaining\n"
                    elif days_remaining < 21:
                        response += f"  ⚠️ **Monitor closely** - Reorder recommended\n"
                    else:
                        response += f"  ✅ **Adequate supply** - {days_remaining:.0f} days remaining\n"

                    response += f"\n"

        response += f"**Machine Learning Predictions Consider:**\n"
        response += f"• Historical usage patterns and seasonality\n"
        response += f"• Recent trend acceleration or deceleration\n"
        response += f"• External factors (holidays, emergencies, epidemics)\n"
        response += f"• Supplier lead times and reliability\n\n"

        response += f"**Prediction confidence varies based on:**\n"
        response += f"• Data quality and historical depth\n"
        response += f"• Stability of usage patterns\n"
        response += f"• External disruption factors\n"

        return {
            "response": response,
            "confidence": 0.7,
            "response_type": "prediction_analysis"
        }

    def _handle_general_question(self, question, context_data):
        """Handle general dashboard and system questions"""
        response = "🏥 **Healthcare Supply Dashboard Assistant**\n\n"

        response += f"I can help you with:\n\n"
        response += f"**📊 Supply Analysis**: Ask about stock levels, usage patterns, or trends\n"
        response += f"**🚨 Emergency Decisions**: Get AI recommendations for urgent purchases\n"
        response += f"**💰 Budget Impact**: Understand costs, waste, and savings opportunities\n"
        response += f"**🔮 Predictions**: Review demand forecasts and depletion timelines\n"
        response += f"**📈 Trends**: Analyze what patterns suggest for future needs\n\n"

        response += f"**Example questions:**\n"
        response += f"• 'What items need emergency purchases?'\n"
        response += f"• 'Why are my costs increasing?'\n"
        response += f"• 'What trends suggest we need more masks?'\n"
        response += f"• 'Which items will run out first?'\n"
        response += f"• 'Is this an emergency situation?'\n\n"

        response += f"**Your current system status:**\n"
        inventory_count = len(context_data.get('inventory', []))
        response += f"• {inventory_count} items being monitored\n"
        response += f"• AI Judge system active and monitoring\n"
        response += f"• Real-time demand forecasting enabled\n"

        return {
            "response": response,
            "confidence": 0.95,
            "response_type": "general_help"
        }