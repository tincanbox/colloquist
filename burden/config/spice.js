/* Global spice up config.
 */
module.exports = (core) => {
  return {
    "company_list": ["JAST", "JANY"],
    "head_csv_path": core.config.path.storage + "/csv/today/",
    "colinker_credential" : {
      "JAST": {
        "user": "JAST",
        "password": "a0359396705"
      },
      "JANY": {
        "user": "JANY",
        "password": "a0359396705"
      }
    }
  }
}
