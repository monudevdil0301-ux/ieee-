export interface SampleProject {
  id: string;
  name: string;
  type: 'Renewable energy' | 'Transport' | 'Waste management';
  location: string;
  claimedTonnes: number;
  filename: string;
  csvContent: string;
  description: string;
}

export const SAMPLE_DATASETS: Record<string, SampleProject> = {
  solarClean: {
    id: 'CT-2026-0042',
    name: 'Rajasthan 250kW Solar Microgrid',
    type: 'Renewable energy',
    location: 'Bikaner, Rajasthan, India',
    claimedTonnes: 128.4,
    filename: 'bikaner_inverter_q3_metering.csv',
    description: 'High-resolution telemetry from SMA Sunny Tripower inverters. Clear daytime solar generation profile matching local DNI irradiance.',
    csvContent: `hour,actual_kwh,irradiance_wm2
0,0.0,0
1,0.0,0
2,0.0,0
3,0.0,0
4,0.0,0
5,0.0,0
6,4.8,120
7,18.2,280
8,35.4,450
9,52.1,620
10,68.7,780
11,74.2,840
12,77.8,870
13,76.1,850
14,69.5,790
15,53.4,630
16,36.2,460
17,19.0,290
18,5.1,130
19,0.0,0
20,0.0,0
21,0.0,0
22,0.0,0
23,0.0,0`
  },
  fleetTransit: {
    id: 'CT-2026-0041',
    name: 'Pune Municipal Electric Bus Fleet',
    type: 'Transport',
    location: 'Pune, Maharashtra, India',
    claimedTonnes: 82.0,
    filename: 'pune_ev_bus_telemetry_oct.csv',
    description: 'Fleet management telemetry for 18 electric buses substituting standard Bharat Stage IV diesel buses.',
    csvContent: `hour,actual_kwh,distance_km
0,25.0,90
1,18.0,70
2,12.0,45
3,10.0,40
4,15.0,55
5,38.0,140
6,72.0,260
7,95.0,340
8,110.0,390
9,105.0,370
10,88.0,310
11,82.0,290
12,85.0,300
13,87.0,310
14,92.0,330
15,102.0,360
16,115.0,410
17,118.0,420
18,105.0,380
19,82.0,290
20,65.0,230
21,48.0,170
22,35.0,130
23,28.0,100`
  },
  biogasWaste: {
    id: 'CT-2026-0040',
    name: 'Nashik Agro-Waste Biogas Co-op',
    type: 'Waste management',
    location: 'Nashik, Maharashtra, India',
    claimedTonnes: 46.2,
    filename: 'nashik_biogas_ch4_sensor.csv',
    description: 'Anaerobic digester telemetry with ultrasonic methane flow meter and temperature tracking.',
    csvContent: `hour,actual_m3,feedstock_kg
0,14.2,22
1,14.1,22
2,13.9,22
3,14.0,22
4,14.2,22
5,14.5,22
6,15.2,24
7,16.8,26
8,18.4,28
9,19.2,30
10,20.1,31
11,20.5,32
12,20.8,32
13,20.4,31
14,19.8,30
15,18.9,29
16,17.5,27
17,16.2,25
18,15.4,24
19,14.9,23
20,14.5,22
21,14.3,22
22,14.1,22
23,14.0,22`
  },
  fraudulentSolar: {
    id: 'CT-2026-0043',
    name: 'Suspicious / Manipulated Solar Farm',
    type: 'Renewable energy',
    location: 'Gujarat, India',
    claimedTonnes: 260.0, // Inflated claim!
    filename: 'suspicious_tampered_solar_log.csv',
    description: 'Tampered dataset with impossible generation at 2:00 AM (night-time power!) and 140% inflated daytime capacity.',
    csvContent: `hour,actual_kwh,irradiance_wm2
0,0.0,0
1,0.0,0
2,42.5,0
3,38.0,0
4,0.0,0
5,0.0,0
6,8.2,120
7,45.0,280
8,95.0,450
9,148.0,620
10,185.0,780
11,195.0,840
12,210.0,870
13,198.0,850
14,175.0,790
15,140.0,630
16,88.0,460
17,42.0,290
18,12.0,130
19,0.0,0
20,0.0,0
21,0.0,0
22,0.0,0
23,0.0,0`
  }
};
