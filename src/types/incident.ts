export interface Location {
  latitude: number;
  longitude: number;
  name: string;
}

export interface Media {
  type: 'image' | 'video' | 'document';
  url: string;
  caption?: string;
}

export interface HistoricalIncident {
  id: string;
  title: string;
  description: string;
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate?: string; // ISO date string
  location: Location;
  category: 'political' | 'religious' | 'cultural' | 'scientific' | 'military';
  connections: string[]; // Related incident IDs
  learningPath?: string;
  media?: Media[];
  dynasty?: string;
  region?: string;
}
