from fastapi import APIRouter
from typing import Dict, Any, List

router = APIRouter(prefix="/guidance", tags=["Regional Guidance & Legal Norms"])

@router.get("")
def get_regional_guidance() -> Dict[str, Any]:
    """
    Returns legal norms, restricted roads, and safety disclaimers per region.
    Fulfills Known Limitations 8 & 9.
    """
    return {
        "disclaimer": (
            "HitchSafe is an assistive risk-reduction utility and situational awareness tool. "
            "It CANNOT guarantee safety or prevent criminal acts. Always trust your intuition; "
            "refuse rides without hesitation if something feels off. Memorize emergency numbers (112 in India/EU, 911 in US)."
        ),
        "regions": [
            {
                "region_id": "india",
                "name": "India (National & State Highways)",
                "legal_status": "Legal on general public roads; strictly prohibited on access-controlled expressways.",
                "rules": [
                    "Expressway Prohibitions: Pedestrians and hitchhiking are strictly banned inside toll gates on access-controlled expressways (e.g. Samruddhi Mahamarg, Delhi-Mumbai Expressway, Bengaluru-Mysuru Expressway). Stand only at slip lanes or pre-toll entry roads.",
                    "National Highways (NH): Standing on asphalt shoulders before toll barriers or petrol pumps (dhabas) is common and permitted as long as traffic is not obstructed.",
                    "Night Warning: Never hitchhike after dusk in isolated rural corridors or forest checkposts (e.g., Bandipur, Western Ghats). Night transit is unsafe.",
                    "Cultural Norms: In India, offering a ride is often seen as voluntary hospitality (lift/sahayata). Commercial trucks (lorries) frequently stop and may expect a nominal chai/fuel contribution."
                ],
                "emergency_numbers": {
                    "national_emergency": "112",
                    "police": "100",
                    "highway_patrol": "1033 (NHAI Emergency Helpline)",
                    "women_helpline": "1091"
                }
            },
            {
                "region_id": "europe",
                "name": "European Union / Schengen",
                "legal_status": "Legal, except directly on motorways (Autobahn/Autoroute).",
                "rules": [
                    "Motorway Rules: Standing directly on the Autobahn/Autoroute carriageway is illegal and dangerous. Hitching is permitted at Raststätte (service stations), on-ramps before the highway sign, and toll stations (Péage in France).",
                    "High-visibility vest: Mandatory to carry in many European countries if walking alongside road shoulders."
                ],
                "emergency_numbers": {
                    "european_emergency": "112"
                }
            },
            {
                "region_id": "north_america",
                "name": "United States & Canada",
                "legal_status": "State/Provincial jurisdiction varies widely.",
                "rules": [
                    "Interstate Highways: Illegal to stand on the paved travel lane or shoulder of Interstate freeways; legal on entrance ramps before the 'No Pedestrians Beyond This Sign' marker.",
                    "State Variations: Fully legal in 44 US states when standing on the road verge; prohibited in a few specific states."
                ],
                "emergency_numbers": {
                    "emergency": "911"
                }
            }
        ]
    }
