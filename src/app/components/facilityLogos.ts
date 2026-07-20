// Maps each facility name to its Google Drive file ID.
// Facilities with no logo entry return null (no image rendered).
export const FACILITY_LOGO_IDS: Record<string, string | null> = {
  "Bluegrass Care & Rehabilitation Center": "1711je3tuHfny9Sb-86un1xC5YQCLgZqk",
  "Clinton County Care & Rehabilitation Center": "1IClzCDEGUrLE3zBd_TlW9LAfZdij0oum",
  "Danville Centre for Health & Rehabilitation": "1NuIkFuuc3r5m0fPjN5HVQD2oEhvRw6V5",
  "Fountain Circle Care & Rehabilitation Center": "1xoyjczuqaXE22PeWDVOV0P0xwwFkQyxy",
  "Harrodsburg Health & Rehabilitation Center": "1MSNOOm1bjFTOp-QZ-r4p_3oO2pDAYIjN",
  "Hermitage Care & Rehabilitation Center": "1WCINBFZ_JjFjrExfDOU3FU5T1MFaBVqn",
  "Lee County Care & Rehabilitation Center": "1QKpapFv-aJcniWhbbf04Sjet1izS9QzK",
  "Liberty Care & Rehabilitation Center": "1pLzrjFG2QtQdhDkh1biibuHq9dwFzpvw",
  "Mayfair Manor": "16U8NmS8guGR9nXn_fRsQ2LNyDCu8D1Z1",
  "Monroe County Rehab & Wellness Center": "1c-8s47WdrR5AKRIaVH6dkw6fFAYBLUbF",
  "Morgantown Care & Rehabilitation Center": "14TOwEftc7k5GlNyOuHVjdfF4J3b6dfBc",
  "Mountain City Care & Rehabilitation Center": "1Q5NY3x71EDKfaolHlKHXQbmlU8Sjo4m1",
  "Oakview Nursing & Rehabilitation Center": "1SYqu1rRwdLYA4x97iwAgkHLAg5iTBKz3",
  "Pickett Care & Rehabilitation Center": "11ca8PBlnGFa-gUGIUG9MS8LBvsg-tqSj",
  "Prestonsburg Health Care Center": "10A2GGR8NMoN5jBSoMpz30h5N-b5OzGzn",
  "Princeton Assisted Living and Transitional Care": null,
  "Riverside Care & Rehabilitation Center": "19-4Ag2U0JWmn2DOnkxTSPNPiYk38lt7n",
  "Riverview Health Care Center": "16clQy6sZQ5Q-a6F6Ml6WCX_8XFEPLDMX",
  "Rockcastle Health & Rehabilitation Center": "10R1mPjw99ig2xsjBqPu-qB1e79zhAlA-",
  "Signature HealthCARE at Colonial": "1QI3pP-es5d1FXxj7pQgoaiFekYjV9u0_",
  "Signature HealthCARE at Heritage Hall": "1zSm4HTBWTcoPy658FcbRKhq3UhspICax",
  "Signature HealthCARE at Hillcrest": "1U9V0nFUlmxVntJDxKzC9aohYqzIGRjGr",
  "Signature HealthCARE at Jackson Manor": "1vw-0HE-Irzr0jS-QMKJ8FtqcEyIzDgYq",
  "Signature HealthCARE at Jefferson Manor": "1SLrR_0MEuZ1upAQwyDCJSfxrj3UlHaXf",
  "Signature HealthCARE at Jefferson Place": "1DJxUpQPBeJtQMKIyd9F-myz3nsOF5O6O",
  "Signature HealthCARE at Parkwood": "1RsBtsBhVdqWKMmlxYNUgbcm7qIstfIsX",
  "Signature HealthCARE at Rockford": "17X6lWaQFxLn4IyG9b2pLqzmNzrlNxX3B",
  "Signature HealthCARE at Summerfield": "1_rJ171wq5Wx9mbg6peLgs3TzDpFfwq_W",
  "Signature HealthCARE at Summit Manor": "1eGBP19bu0rCqi_XAUC2tNCCHVBqZO48m",
  "Signature HealthCARE of Bowling Green": "1-WUI6eiH-AHnrOgMyb8NVlvr_cQgcIIc",
  "Signature HealthCARE of Bremen": "1ka-J0c6qdwWoIL7y9SfsRK9Lg_jKQQSq",
  "Signature HealthCARE of Carrollton": "1USQfUCYL40r_vJTwIbRn9D-g3_kV8kas",
  "Signature HealthCARE of Chapel Hill": "1eqBeoCsfdAikFg5713RqGSFdnl21rbk0",
  "Signature HealthCARE of Clarksville": "1B5dloLjMOGWmqGGlWWlvcATDMqO8tRi_",
  "Signature HealthCARE of Cleveland": "1badeRnUg6jHrbnWWKM2ibuJAg7WQNdHI",
  "Signature HealthCARE of East Louisville": "1PktqaC-mENTvjoAtpQjBPnRh214ExNMt",
  "Signature HealthCARE of Elizabethton": "1n_y5RYepARu_53_y0_jkNdr3Bodbqcrk",
  "Signature HealthCARE of Elizabethtown": "1ueCvpAQ585As9XrdbRWQJ5o0Glq-kHHA",
  "Signature HealthCARE of Erin": "1RdUSPmlUEfJEHrlAK8eL8-C75uQSaaFg",
  "Signature HealthCARE of Fayette County": null,
  "Signature HealthCARE of Fentress County": "1TQrMur8n2hVNdIUUE8YLTRP6pXiJQMZU",
  "Signature HealthCARE of Galion": null,
  "Signature HealthCARE of Georgetown": "1F9fE3-GTLf_bpzfgDKNMrD3-XnEu6kUI",
  "Signature HealthCARE of Glasgow": "1El7Fygh1LB35RE2LPAB8NV7sPcfD9IGF",
  "Signature HealthCARE of Greeneville": "1ZraKEywlLXyvfKxNd0StnqD7U63MmT3f",
  "Signature HealthCARE of Hart County": "1dsX6pYPwicsivgIWkIlOJHMVOWw01ufB",
  "Signature HealthCARE of Hartford": "1zt4m7vgBOLmoZe5BQAU6sZmu68zYzVqR",
  "Signature HealthCARE of Kinston": "1MRRnf9b8aNY_yYhGBJU1_3PJQhrhoVca",
  "Signature HealthCARE of McCreary County": "1TBiQ_fjdIavHKG1T2ppz3VSXk_kkUjiA",
  "Signature HealthCARE of Memphis": "1Mh-nQ8kOXjei-sAobxE0rfcS1Nvy98aw",
  "Signature HealthCARE of Monteagle": "170yKPaG-5-UDvOerAllQSl32Y-eIxDuF",
  "Signature HealthCARE of Muncie": "1TxcZmV2QXOdZMw50n6l5d7BaA2UEHejf",
  "Signature HealthCARE of Norfolk": "1FxET9wGEnLtC5CVBHfC0Mdt_eHkTfnYC",
  "Signature HealthCARE of North Hardin": "1f2dt-Q1KBSJ2tg5KTrMHt0y1wu6cEfa0",
  "Signature HealthCARE of Portland": "1YSDcz0LRJotEFnUXFLr4dgmV4uVS_ih8",
  "Signature HealthCARE of Primacy": "1ViN9gtRsEQ7wElo69INlDM66uv3xhEf2",
  "Signature HealthCARE of Putnam": "1U020oG-8W2s7fm-6IA1awRmKhOc3kxtA",
  "Signature HealthCARE of Ridgely": "1mbbvh8RLoeU-4WwBRK31z3X_ex3GEzGA",
  "Signature HealthCARE of Roanoke Rapids": "1h-EfmPraqYcNymVdcq3FPwkFvaYBaSjv",
  "Signature HealthCARE of Rockwood": "1m9QXNmkzmubaeVv2-toVxI60IFL3RE3k",
  "Signature HealthCARE of Rogersville": "1y9TMYUBjydks9zHx5HHrR_frQUkEmvb7",
  "Signature HealthCARE of South Louisville": "1lqxZJzw9ROKXrfkRFtHsRkzoMWmEyCd6",
  "Signature HealthCARE of South Pittsburg": "1vZQsxOxyr3vO_byq7T_kQB8CIXSUiear",
  "Signature HealthCARE of Spencer County": "1x5ajymKz7c79pw6C3O9XGrCghIHLU6mr",
  "Signature HealthCARE of Terre Haute": "173xRorA_iIkqgjmdFY001MCNTPa-3hWu",
  "Spring City Care & Rehab": "16EEf_bWy7puzeBtj2N7M89uBxC-0fZ4T",
  "Standing Stone Care & Rehab": "1wgSznuZBTDithmfpb1vQsCW6VHUM2end",
  "Sunrise Manor": "1gFvOfBHmjcdre2DjsgJlnQFXSTqqKtVc",
  "Westmoreland Care & Rehabilitation Center": "1P7lvS_NHBBW5u5jU22mUZ50JzwMdNiSA",
};

export function getFacilityLogoUrl(facility: string): string | null {
  const id = FACILITY_LOGO_IDS[facility];
  if (!id) return null;
  // Direct image URL for publicly shared Google Drive files
  return `https://lh3.googleusercontent.com/d/${id}`;
}

export async function fetchLogoAsDataUrl(facility: string): Promise<string | null> {
  const url = getFacilityLogoUrl(facility);
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
