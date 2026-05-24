export type VocalSyllable = {
  syllable: string;
  word: string;
  start_time: number;
  end_time: number;
  duration: number;
  confidence: number;
};

export type VocalResultsData = {
  syllables?: VocalSyllable[];
  song_info?: {
    identified?: boolean;
    title?: string;
    artist?: string;
  };
  processing?: {
    total_syllables?: number;
    confidence?: number;
    processing_time?: number;
  };
  timing?: {
    song_duration?: number;
  };
};

export type PercussionAnalysis = {
  kicks?: number[];
  snares?: number[];
  drums_by_type?: Record<string, number[]>;
  all_drums?: number[];
  total_drums?: number;
  visualization?: string;
  timing_analysis?: {
    average_bpm?: number;
  } & Record<string, unknown>;
};

export type PercussionResultsData = {
  analysis?: PercussionAnalysis;
  session_id?: string;
};

export type CombinedAnalysisResults = {
  filename?: string;
  song_title?: string;
  songTitle?: string;
  artist?: string;
  bpm?: number | string;
  duration_seconds?: number | string;
  durationSeconds?: number | string;
  chart_file?: string;
  chartFile?: string;
  metadata?: {
    song_title?: string;
    artist?: string;
    bpm?: number | string;
    duration_seconds?: number | string;
  };
  results?: {
    chart_file?: string;
    bpm?: number | string;
    duration_seconds?: number | string;
    vocal_analysis?: {
      syllables?: unknown[];
    };
    percussion_analysis?: {
      drum_hits?: unknown[];
    };
  };
  summary?: {
    total_syllables?: number;
    drum_hits?: number;
  };
  vocal_analysis?: {
    success?: boolean;
    data?: VocalResultsData;
    error?: string;
    syllables?: unknown[];
  };
  percussion_analysis?: {
    success?: boolean;
    data?: PercussionResultsData;
    error?: string;
    drum_hits?: unknown[];
  };
};
