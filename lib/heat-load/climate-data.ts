/**
 * Climate-station data extracted from suissetec V6.6 ("Outil de calcul pour
 * les besoins de chaleur", juni 2021). The xlsx sheet "Calcul puissance"
 * carries 40 Swiss meteo stations with:
 *   - per-year heating degree-days (Degrés-jours de chauffage, DJC 20/12)
 *     for 2012-2020 — used to normalize a rep's fuel-consumption history
 *     against long-term-average heating demand
 *   - long-term average DJC ("SIA 2028 Korr. C" column) — the reference
 *     value the normalization scales TO
 *   - design outdoor temperature, indoor temperature, daily operating
 *     hours, and full-load operating hours per ECS-source variant
 *
 * Source xlsx is not vendored (1.3MB, redistribution restricted). This
 * file is the canonical port; refresh by re-running prisma/scripts/
 * extract-heat-load-data.mjs (see PROCESS.md, future) when suissetec
 * publishes V6.7+.
 *
 * Year range note: only 2012-2020 are captured. If a rep enters fuel
 * consumption for 2021+, calculate.ts falls back to interpolating from
 * djcLongTermAvg with a small uncertainty band. v1.x adds 2021-2024.
 */

export type ClimateStation = {
  /** Station name as displayed on cantonal forms (canonical spelling). */
  name: string
  /**
   * Per-year heating degree-day values. Key is the year (string for JSON
   * compatibility — readers should not assume integer key order). Used as
   * the denominator when normalizing rep-entered consumption against the
   * long-term average.
   */
  djcByYear: Record<string, number>
  /**
   * Long-term average DJC ("langjähriger Mittelwert SIA 2028 Korr. C").
   * Used as the numerator when normalizing.
   */
  djcLongTermAvg: number
  /** Design outdoor temperature per SIA MB 2028 [°C]. */
  designTempC: number
  /** Reference indoor air temperature [°C], typically 21°C. */
  indoorTempC: number
  /** Daily operating hours of the heating system [h]. */
  opHoursPerDay: number
  /** Full-load operating hours per year [h] when DHW is separate. */
  fullLoadHoursSepare: number
  /** Full-load operating hours per year [h] when DHW shares the heating. */
  fullLoadHoursAvecChauffage: number
}

export const CLIMATE_STATIONS: readonly ClimateStation[] = [
  {
    "name": "Adelboden",
    "djcByYear": {
      "2012": 4501.7,
      "2013": 4812.3,
      "2014": 4281.1,
      "2015": 4350.5,
      "2016": 4451.3,
      "2017": 4443.9,
      "2018": 3953.4,
      "2019": 4290.3,
      "2020": 4082.8
    },
    "djcLongTermAvg": 4669,
    "designTempC": -10,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2550,
    "fullLoadHoursAvecChauffage": 2950
  },
  {
    "name": "Aigle",
    "djcByYear": {
      "2012": 2917.3,
      "2013": 3176.7,
      "2014": 2534.5,
      "2015": 2936,
      "2016": 3048.5,
      "2017": 3190.2,
      "2018": 2699.1,
      "2019": 2918,
      "2020": 2798.5
    },
    "djcLongTermAvg": 3152,
    "designTempC": -6,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2000,
    "fullLoadHoursAvecChauffage": 2300
  },
  {
    "name": "Altdorf",
    "djcByYear": {
      "2012": 3131.7,
      "2013": 3302.3,
      "2014": 2601.1,
      "2015": 3058.8,
      "2016": 3028.9,
      "2017": 3168.8,
      "2018": 2635.1,
      "2019": 2918.2000000000003,
      "2020": 2895.5999999999995
    },
    "djcLongTermAvg": 3201,
    "designTempC": -6,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2000,
    "fullLoadHoursAvecChauffage": 2300
  },
  {
    "name": "Basel-Binningen",
    "djcByYear": {
      "2012": 2926.5,
      "2013": 3112.2,
      "2014": 2398.8,
      "2015": 2677.8,
      "2016": 3024.3,
      "2017": 2870,
      "2018": 2618.7,
      "2019": 2707.7,
      "2020": 2507.2000000000003
    },
    "djcLongTermAvg": 3034,
    "designTempC": -7,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 1850,
    "fullLoadHoursAvecChauffage": 2150
  },
  {
    "name": "Bern Liebefeld",
    "djcByYear": {
      "2012": 3524.2,
      "2013": 3670.3,
      "2014": 3000,
      "2015": 3307.4,
      "2016": 3472.1,
      "2017": 3491,
      "2018": 3083.4,
      "2019": 3297.1000000000004,
      "2020": 3113.9
    },
    "djcLongTermAvg": 3513,
    "designTempC": -7,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2150,
    "fullLoadHoursAvecChauffage": 2450
  },
  {
    "name": "Buchs-Aarau",
    "djcByYear": {
      "2012": 3234.5,
      "2013": 3409.8,
      "2014": 2733.9,
      "2015": 3030.3,
      "2016": 3262.7,
      "2017": 3210.3,
      "2018": 2849.7,
      "2019": 2983.5000000000005,
      "2020": 2872.7999999999997
    },
    "djcLongTermAvg": 3325,
    "designTempC": -7,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2000,
    "fullLoadHoursAvecChauffage": 2300
  },
  {
    "name": "Chur",
    "djcByYear": {
      "2012": 3159.6,
      "2013": 3241.9,
      "2014": 2511,
      "2015": 2990.5,
      "2016": 3033.7,
      "2017": 3077.6,
      "2018": 2654.7,
      "2019": 2891,
      "2020": 2811.4
    },
    "djcLongTermAvg": 3334,
    "designTempC": -7,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2000,
    "fullLoadHoursAvecChauffage": 2300
  },
  {
    "name": "Davos",
    "djcByYear": {
      "2012": 5516.6,
      "2013": 5670.5,
      "2014": 5320.5,
      "2015": 5232.7,
      "2016": 5358.1,
      "2017": 5414.3,
      "2018": 4984.9,
      "2019": 5274.799999999999,
      "2020": 5171
    },
    "djcLongTermAvg": 5689,
    "designTempC": -13,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2850,
    "fullLoadHoursAvecChauffage": 3300
  },
  {
    "name": "Disentis",
    "djcByYear": {
      "2012": 4347.2,
      "2013": 4444.8,
      "2014": 3909,
      "2015": 4071,
      "2016": 4188.7,
      "2017": 4325.1,
      "2018": 3689,
      "2019": 4065,
      "2020": 3881
    },
    "djcLongTermAvg": 4418,
    "designTempC": -10,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2400,
    "fullLoadHoursAvecChauffage": 2750
  },
  {
    "name": "Engelberg",
    "djcByYear": {
      "2012": 4346.8,
      "2013": 4560.7,
      "2014": 3989.4,
      "2015": 4147,
      "2016": 4175.1,
      "2017": 4320.4,
      "2018": 3772.9,
      "2019": 4070.4,
      "2020": 3950.999999999999
    },
    "djcLongTermAvg": 4511,
    "designTempC": -11,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2400,
    "fullLoadHoursAvecChauffage": 2750
  },
  {
    "name": "Genève-Cointrin",
    "djcByYear": {
      "2012": 2936.3,
      "2013": 3162.3,
      "2014": 2428.4,
      "2015": 2794.9,
      "2016": 3008,
      "2017": 2901.6,
      "2018": 2571.2,
      "2019": 2717.7,
      "2020": 2619.7000000000003
    },
    "djcLongTermAvg": 3007,
    "designTempC": -4,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2050,
    "fullLoadHoursAvecChauffage": 2350
  },
  {
    "name": "Glarus",
    "djcByYear": {
      "2012": 3458,
      "2013": 3648.4,
      "2014": 2858,
      "2015": 3302.5,
      "2016": 3340.1,
      "2017": 3467.4,
      "2018": 2965.1,
      "2019": 3210.3000000000006,
      "2020": 3071.6999999999994
    },
    "djcLongTermAvg": 3610,
    "designTempC": -8,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2100,
    "fullLoadHoursAvecChauffage": 2400
  },
  {
    "name": "Grand-St-Bernard",
    "djcByYear": {
      "2012": 7241.1,
      "2013": 7483.7,
      "2014": 7179.9,
      "2015": 6763.8,
      "2016": 7158.6,
      "2017": 6997,
      "2018": 6982.4,
      "2019": 6990.099999999999,
      "2020": 6855.4
    },
    "djcLongTermAvg": 7413,
    "designTempC": -15,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 3500,
    "fullLoadHoursAvecChauffage": 4050
  },
  {
    "name": "Güttingen",
    "djcByYear": {
      "2012": 3318.2,
      "2013": 3455.3,
      "2014": 2786.5,
      "2015": 3108.3,
      "2016": 3268.6,
      "2017": 3279.1,
      "2018": 2877.1,
      "2019": 3078.8,
      "2020": 2910
    },
    "djcLongTermAvg": 3472,
    "designTempC": -7,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2100,
    "fullLoadHoursAvecChauffage": 2400
  },
  {
    "name": "Interlaken",
    "djcByYear": {
      "2012": 3475.3,
      "2013": 3566.3,
      "2014": 2903.9,
      "2015": 3309.2,
      "2016": 3410.2,
      "2017": 3523.2,
      "2018": 3024.8,
      "2019": 3225.4,
      "2020": 3138.5
    },
    "djcLongTermAvg": 3630,
    "designTempC": -7,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2200,
    "fullLoadHoursAvecChauffage": 2550
  },
  {
    "name": "La Chaux-de-Fonds",
    "djcByYear": {
      "2012": 4230.7,
      "2013": 4483.1,
      "2014": 3870.6,
      "2015": 4152.8,
      "2016": 4257.7,
      "2017": 4313.2,
      "2018": 3682.2,
      "2019": 4035.1,
      "2020": 3803.8999999999996
    },
    "djcLongTermAvg": 4471,
    "designTempC": -10,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2450,
    "fullLoadHoursAvecChauffage": 2800
  },
  {
    "name": "La Frétaz",
    "djcByYear": {
      "2012": 4584,
      "2013": 4866.8,
      "2014": 4308,
      "2015": 4359.2,
      "2016": 4477.6,
      "2017": 4388.9,
      "2018": 3899.6,
      "2019": 4310,
      "2020": 4085.5
    },
    "djcLongTermAvg": 4723,
    "designTempC": -10,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2600,
    "fullLoadHoursAvecChauffage": 3000
  },
  {
    "name": "Locarno-Monti",
    "djcByYear": {
      "2012": 2316.1,
      "2013": 2443.3,
      "2014": 1991.6,
      "2015": 2017.7,
      "2016": 2250.9,
      "2017": 2168.6,
      "2018": 2253.3,
      "2019": 2016.6000000000001,
      "2020": 2061.2999999999997
    },
    "djcLongTermAvg": 2477,
    "designTempC": -1,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 1900,
    "fullLoadHoursAvecChauffage": 2200
  },
  {
    "name": "Lugano",
    "djcByYear": {
      "2012": 2313.9,
      "2013": 2336.1,
      "2014": 1925.6,
      "2015": 2077.9,
      "2016": 2176.6,
      "2017": 2193.7,
      "2018": 2125.5,
      "2019": 2033.8,
      "2020": 2105.8
    },
    "djcLongTermAvg": 2438,
    "designTempC": -1,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 1900,
    "fullLoadHoursAvecChauffage": 2200
  },
  {
    "name": "Luzern",
    "djcByYear": {
      "2012": 3236.4,
      "2013": 3399.5,
      "2014": 2682.3,
      "2015": 2983.6,
      "2016": 3210.9,
      "2017": 3156.4,
      "2018": 2807.9,
      "2019": 2966.4999999999995,
      "2020": 2887.1
    },
    "djcLongTermAvg": 3317,
    "designTempC": -6,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2100,
    "fullLoadHoursAvecChauffage": 2400
  },
  {
    "name": "Magadino",
    "djcByYear": {
      "2012": 2729.6,
      "2013": 2703.3,
      "2014": 2301.6,
      "2015": 2583.8,
      "2016": 2653.4,
      "2017": 2646.1,
      "2018": 2423.4,
      "2019": 2374.4,
      "2020": 2564.8
    },
    "djcLongTermAvg": 2736,
    "designTempC": -3,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 1950,
    "fullLoadHoursAvecChauffage": 2250
  },
  {
    "name": "Montana",
    "djcByYear": {
      "2012": 4544.8,
      "2013": 4738.6,
      "2014": 4293.6,
      "2015": 4302.2,
      "2016": 4547.7,
      "2017": 4502,
      "2018": 3976.9,
      "2019": 4384,
      "2020": 4189.799999999999
    },
    "djcLongTermAvg": 4770,
    "designTempC": -10,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2600,
    "fullLoadHoursAvecChauffage": 3000
  },
  {
    "name": "Neuchâtel",
    "djcByYear": {
      "2012": 3005.5,
      "2013": 3233.5,
      "2014": 2547.3,
      "2015": 2755.4,
      "2016": 3053.4,
      "2017": 2906.7,
      "2018": 2733.2,
      "2019": 2900.8,
      "2020": 2720.9
    },
    "djcLongTermAvg": 3121,
    "designTempC": -5,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2050,
    "fullLoadHoursAvecChauffage": 2350
  },
  {
    "name": "Payerne",
    "djcByYear": {
      "2012": 3276.1,
      "2013": 3475.3,
      "2014": 2794,
      "2015": 3113.8,
      "2016": 3347.7,
      "2017": 3243.4,
      "2018": 2902.4,
      "2019": 3095.8,
      "2020": 2994.3
    },
    "djcLongTermAvg": 3413,
    "designTempC": -7,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2050,
    "fullLoadHoursAvecChauffage": 2350
  },
  {
    "name": "Piotta",
    "djcByYear": {
      "2012": 3830.6,
      "2013": 3994.2,
      "2014": 3551.1,
      "2015": 3732.4,
      "2016": 3864,
      "2017": 3839.6,
      "2018": 3558.9,
      "2019": 3747.1000000000004,
      "2020": 3683.4
    },
    "djcLongTermAvg": 3994,
    "designTempC": -7,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2400,
    "fullLoadHoursAvecChauffage": 2750
  },
  {
    "name": "Pully",
    "djcByYear": {
      "2012": 2715.3,
      "2013": 3089.4,
      "2014": 2322.6,
      "2015": 2586.3,
      "2016": 2866,
      "2017": 2750.7,
      "2018": 2547.1,
      "2019": 2671.2,
      "2020": 2472.8
    },
    "djcLongTermAvg": 2902,
    "designTempC": -4,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 1950,
    "fullLoadHoursAvecChauffage": 2250
  },
  {
    "name": "Robbia",
    "djcByYear": {
      "2012": 3925.3,
      "2013": 4104.9,
      "2014": 3673.3,
      "2015": 3722.7,
      "2016": 3916.6,
      "2017": 4010.5,
      "2018": 3633.8,
      "2019": 3789.4,
      "2020": 3867.6
    },
    "djcLongTermAvg": 4233,
    "designTempC": -8,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2500,
    "fullLoadHoursAvecChauffage": 2900
  },
  {
    "name": "Rünenberg",
    "djcByYear": {
      "2012": 3350.4,
      "2013": 3671.8,
      "2014": 2791,
      "2015": 3051.5,
      "2016": 3396.8,
      "2017": 3302.6,
      "2018": 3025.8,
      "2019": 3180.2999999999997,
      "2020": 2931.000000000001
    },
    "djcLongTermAvg": 3550,
    "designTempC": -8,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2100,
    "fullLoadHoursAvecChauffage": 2400
  },
  {
    "name": "Samedan",
    "djcByYear": {
      "2012": 6129.7,
      "2013": 6214.9,
      "2014": 5968.2,
      "2015": 5797.3,
      "2016": 5962.4,
      "2017": 5944.6,
      "2018": 5701.5,
      "2019": 5912.900000000001,
      "2020": 5871.3
    },
    "djcLongTermAvg": 6375,
    "designTempC": -18,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2800,
    "fullLoadHoursAvecChauffage": 3200
  },
  {
    "name": "San Bernardino",
    "djcByYear": {
      "2012": 5236.3,
      "2013": 5434.2,
      "2014": 5395.7,
      "2015": 5087.6,
      "2016": 5141.7,
      "2017": 5108.3,
      "2018": 4967,
      "2019": 5160.700000000001,
      "2020": 5147.000000000001
    },
    "djcLongTermAvg": 5586,
    "designTempC": -11,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2950,
    "fullLoadHoursAvecChauffage": 3400
  },
  {
    "name": "St. Gallen",
    "djcByYear": {
      "2012": 3325.8,
      "2013": 3491.1,
      "2014": 2744.9,
      "2015": 3023.2,
      "2016": 3288.8,
      "2017": 3270.8,
      "2018": 2842.8,
      "2019": 3069.6,
      "2020": 2977.2
    },
    "djcLongTermAvg": 3844,
    "designTempC": -9,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2200,
    "fullLoadHoursAvecChauffage": 2550
  },
  {
    "name": "Schaffhausen",
    "djcByYear": {
      "2012": 4736,
      "2013": 4850.6,
      "2014": 4388.2,
      "2015": 4494,
      "2016": 4666.1,
      "2017": 4728,
      "2018": 4190.2,
      "2019": 4700.700000000001,
      "2020": 4475.5
    },
    "djcLongTermAvg": 3443,
    "designTempC": -8,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2000,
    "fullLoadHoursAvecChauffage": 2300
  },
  {
    "name": "Scuol",
    "djcByYear": {
      "2012": 2913.9,
      "2013": 3152.7,
      "2014": 2477.4,
      "2015": 2879.7,
      "2016": 2996.1,
      "2017": 2883.3,
      "2018": 2622.6,
      "2019": 2762.7000000000003,
      "2020": 2818.7
    },
    "djcLongTermAvg": 4866,
    "designTempC": -12,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2500,
    "fullLoadHoursAvecChauffage": 2900
  },
  {
    "name": "Sion",
    "djcByYear": {
      "2012": 3667.7,
      "2013": 3967,
      "2014": 3104.2,
      "2015": 3418.3,
      "2016": 3628.8,
      "2017": 3580.5,
      "2018": 3210.4,
      "2019": 3440.6,
      "2020": 3321.2000000000003
    },
    "djcLongTermAvg": 3195,
    "designTempC": -6,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2000,
    "fullLoadHoursAvecChauffage": 2300
  },
  {
    "name": "Ulrichen",
    "djcByYear": {
      "2012": 5319.4,
      "2013": 5525.3,
      "2014": 4968.4,
      "2015": 5100.5,
      "2016": 5200.1,
      "2017": 5212.8,
      "2018": 4807.9,
      "2019": 5152.9,
      "2020": 4948.1
    },
    "djcLongTermAvg": 5546,
    "designTempC": -16,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2550,
    "fullLoadHoursAvecChauffage": 2950
  },
  {
    "name": "Vaduz",
    "djcByYear": {
      "2012": 2985.9,
      "2013": 3254.7,
      "2014": 2381.5,
      "2015": 2908.7,
      "2016": 2974.8,
      "2017": 2959.3,
      "2018": 2592.9,
      "2019": 2765.8,
      "2020": 2707.8
    },
    "djcLongTermAvg": 3213,
    "designTempC": -8,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 1900,
    "fullLoadHoursAvecChauffage": 2200
  },
  {
    "name": "Wynau",
    "djcByYear": {
      "2012": 3493.7,
      "2013": 3566.4,
      "2014": 2906.9,
      "2015": 3220.5,
      "2016": 3374.8,
      "2017": 3402.4,
      "2018": 2982.2,
      "2019": 3203.6,
      "2020": 3017.3
    },
    "djcLongTermAvg": 3536,
    "designTempC": -7,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2150,
    "fullLoadHoursAvecChauffage": 2450
  },
  {
    "name": "Zermatt",
    "djcByYear": {
      "2012": 5152.9,
      "2013": 5444.1,
      "2014": 5119.7,
      "2015": 4954.8,
      "2016": 5120.3,
      "2017": 5033.5,
      "2018": 4700.6,
      "2019": 4899.4,
      "2020": 4725.9
    },
    "djcLongTermAvg": 5388,
    "designTempC": -11,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2850,
    "fullLoadHoursAvecChauffage": 3300
  },
  {
    "name": "Zürich-Kloten",
    "djcByYear": {
      "2012": 3247.8,
      "2013": 3436.2,
      "2014": 2790.3,
      "2015": 3064.2,
      "2016": 3328.6,
      "2017": 3267,
      "2018": 2896.8,
      "2019": 3061.3999999999996,
      "2020": 2934.4000000000005
    },
    "djcLongTermAvg": 3432,
    "designTempC": -8,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2000,
    "fullLoadHoursAvecChauffage": 2300
  },
  {
    "name": "Zürich-MeteoSchweiz",
    "djcByYear": {
      "2012": 3320.5,
      "2013": 3586,
      "2014": 2783.9,
      "2015": 3060.2,
      "2016": 3334.8,
      "2017": 3233.4,
      "2018": 2934.5,
      "2019": 3111.7,
      "2020": 2932.7
    },
    "djcLongTermAvg": 3440,
    "designTempC": -8,
    "opHoursPerDay": 17,
    "indoorTempC": 21,
    "fullLoadHoursSepare": 2000,
    "fullLoadHoursAvecChauffage": 2300
  }
] as const

/** Const tuple of station names — feeds the form dropdown + z.enum() validator. */
export const CLIMATE_STATION_NAMES = [
  'Adelboden',
  'Aigle',
  'Altdorf',
  'Basel-Binningen',
  'Bern Liebefeld',
  'Buchs-Aarau',
  'Chur',
  'Davos',
  'Disentis',
  'Engelberg',
  'Genève-Cointrin',
  'Glarus',
  'Grand-St-Bernard',
  'Güttingen',
  'Interlaken',
  'La Chaux-de-Fonds',
  'La Frétaz',
  'Locarno-Monti',
  'Lugano',
  'Luzern',
  'Magadino',
  'Montana',
  'Neuchâtel',
  'Payerne',
  'Piotta',
  'Pully',
  'Robbia',
  'Rünenberg',
  'Samedan',
  'San Bernardino',
  'St. Gallen',
  'Schaffhausen',
  'Scuol',
  'Sion',
  'Ulrichen',
  'Vaduz',
  'Wynau',
  'Zermatt',
  'Zürich-Kloten',
  'Zürich-MeteoSchweiz',
] as const

export type ClimateStationName = (typeof CLIMATE_STATION_NAMES)[number]

/** Lookup helper — throws if name isn't in the whitelist. */
export function getClimateStation(name: string): ClimateStation {
  const found = CLIMATE_STATIONS.find((s) => s.name === name)
  if (!found) throw new Error(`Unknown climate station: ${name}`)
  return found
}
