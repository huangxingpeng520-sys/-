
export interface PriceRecord {
  id: string;
  date: string;
  category: string;
  region: string;
  specification: string;
  price: number;
  unit: string;
  source: string;
  change: number;
}

export interface MaterialConfig {
  id: string;
  name: string;
  region: string;
  spec: string;
  active: boolean;
}

export enum RobotStatus {
  IDLE = 'IDLE',
  SCRAPING = 'SCRAPING',
  CLEANING = 'CLEANING',
  UPDATING = 'UPDATING',
  ERROR = 'ERROR'
}
