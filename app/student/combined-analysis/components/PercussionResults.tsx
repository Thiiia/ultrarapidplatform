"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  Paper,
  Typography,
} from "@mui/material";
import {
  Download as DownloadIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  VolumeOff as VolumeOffIcon,
  VolumeUp as VolumeUpIcon,
} from "@mui/icons-material";
import API_CONFIG from "../config";
import styles from "./PercussionResults.module.css";

export type PercussionAnalysis = {
  kicks?: number[];
  snares?: number[];
  all_drums?: number[];
  total_drums?: number;
  drums_by_type?: Record<string, number[]>;
  timing_analysis?: { average_bpm?: number };
  visualization?: string;
};

type Props = {
  analysis: PercussionAnalysis;
  session_id: string;
};

export default function PercussionResults({ analysis, session_id }: Props) {
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volumes, setVolumes] = useState<Record<string, number>>({
    vocals: 1,
    drums: 1,
    bass: 1,
    other: 1,
  });
  const [mutedTracks, setMutedTracks] = useState<Record<string, boolean>>({
    vocals: false,
    drums: false,
    bass: false,
    other: false,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({
    vocals: true,
    drums: true,
    bass: true,
    other: true,
  });

  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const progressRef = useRef<HTMLDivElement | null>(null);

  const trackInfo: Record<string, { name: string; color: string; icon: string }> = {
    vocals: { name: "Vocals", color: "#e74c3c", icon: "🎤" },
    drums: { name: "Drums", color: "#f39c12", icon: "🥁" },
    bass: { name: "Bass", color: "#9b59b6", icon: "🎸" },
    other: { name: "Other", color: "#2ecc71", icon: "🎹" },
  };

  const tracks: Record<string, string> = session_id
    ? {
        vocals: `${API_CONFIG.COMBINED_API_URL}/api/download/${session_id}/vocals`,
        drums: `${API_CONFIG.COMBINED_API_URL}/api/download/${session_id}/drums`,
        bass: `${API_CONFIG.COMBINED_API_URL}/api/download/${session_id}/bass`,
        other: `${API_CONFIG.COMBINED_API_URL}/api/download/${session_id}/other`,
      }
    : {};

  useEffect(() => {
    if (!session_id) return;

    const trackTypes = Object.keys(tracks);
    const primaryTrack = trackTypes[0];

    trackTypes.forEach((trackType) => {
      const audio = audioRefs.current[trackType];
      if (audio) {
        const handleLoadedMetadata = () => {
          if (trackType === primaryTrack) setDuration(audio.duration);
        };

        const handleTimeUpdate = () => {
          if (trackType === primaryTrack && !isDragging) {
            setCurrentTime(audio.currentTime);
          }
        };

        const handleEnded = () => {
          if (trackType === primaryTrack) setIsPlaying(false);
        };

        audio.addEventListener("loadedmetadata", handleLoadedMetadata);
        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("ended", handleEnded);
        audio.volume = volumes[trackType];

        return () => {
          audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
          audio.removeEventListener("timeupdate", handleTimeUpdate);
          audio.removeEventListener("ended", handleEnded);
          audio.pause();
        };
      }
    });
  }, [session_id, tracks, isDragging, volumes]);

  const togglePlayPause = async () => {
    const newIsPlaying = !isPlaying;
    setIsPlaying(newIsPlaying);

    const audioElements = Object.values(audioRefs.current).filter(
      (audio): audio is HTMLAudioElement => !!audio && audio.readyState >= 2,
    );

    if (newIsPlaying) {
      const primaryAudio = audioElements[0];
      if (primaryAudio) {
        const syncTime = primaryAudio.currentTime;
        audioElements.forEach((audio) => {
          if (Math.abs(audio.currentTime - syncTime) > 0.1) {
            audio.currentTime = syncTime;
          }
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      audioElements.forEach((audio) => {
        audio.play().catch((error) => console.warn("Could not start playback:", error));
      });
    } else {
      audioElements.forEach((audio) => audio.pause());
    }
  };

  const restartSong = () => {
    void seekToTime(0);
  };

  const seekToTime = async (newTime: number) => {
    const audioElements = Object.values(audioRefs.current).filter(
      (audio): audio is HTMLAudioElement => !!audio && audio.readyState >= 2,
    );
    const wasPlaying = isPlaying;

    setCurrentTime(newTime);

    if (wasPlaying) {
      audioElements.forEach((audio) => audio.pause());
      setIsPlaying(false);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    audioElements.forEach((audio) => {
      try {
        audio.currentTime = newTime;
      } catch (error) {
        console.warn("Could not set currentTime:", error);
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    if (wasPlaying) {
      setIsPlaying(true);
      audioElements.forEach((audio) => {
        audio.play().catch((error) => console.warn("Could not resume playback:", error));
      });
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging && progressRef.current && duration > 0) {
      const rect = progressRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const newTime = (clickX / rect.width) * duration;
      void seekToTime(newTime);
    }
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (moveEvent.buttons === 1 && progressRef.current && duration > 0) {
        const rect = progressRef.current.getBoundingClientRect();
        const clickX = Math.max(0, Math.min(moveEvent.clientX - rect.left, rect.width));
        const newTime = (clickX / rect.width) * duration;
        setCurrentTime(newTime);
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDragging(false);
      if (progressRef.current && duration > 0) {
        const rect = progressRef.current.getBoundingClientRect();
        const clickX = Math.max(0, Math.min(upEvent.clientX - rect.left, rect.width));
        const finalTime = (clickX / rect.width) * duration;
        setTimeout(() => {
          void seekToTime(finalTime);
        }, 10);
      }

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleVolumeChange = (trackType: string, volume: number) => {
    setVolumes((prev) => ({ ...prev, [trackType]: volume }));
    const audio = audioRefs.current[trackType];
    if (audio) {
      audio.volume = mutedTracks[trackType] ? 0 : volume;
    }
  };

  const toggleMute = (trackType: string) => {
    const newMuted = !mutedTracks[trackType];
    setMutedTracks((prev) => ({ ...prev, [trackType]: newMuted }));
    const audio = audioRefs.current[trackType];
    if (audio) {
      audio.volume = newMuted ? 0 : volumes[trackType];
    }
  };

  const formatTime = (time: number) => {
    if (!time || !isFinite(time) || Number.isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, "0")}`;
  };

  const downloadTrack = async (trackType: string) => {
    try {
      const response = await fetch(tracks[trackType]);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${trackType}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Failed to download ${trackType}:`, error);
      window.open(tracks[trackType], "_blank");
    }
  };

  const downloadKickSnareJSON = () => {
    const data = {
      kicks: analysis.kicks || [],
      snares: analysis.snares || [],
      metadata: {
        total_kicks: (analysis.kicks || []).length,
        total_snares: (analysis.snares || []).length,
        bpm: analysis.timing_analysis?.average_bpm || 0,
        exported_at: new Date().toISOString(),
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kick-snare-timestamps.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAllDrumsJSON = () => {
    const data = {
      drums_by_type: analysis.drums_by_type || {},
      all_drums: analysis.all_drums || [],
      metadata: {
        total_drums: analysis.total_drums || 0,
        bpm: analysis.timing_analysis?.average_bpm || 0,
        timing_analysis: analysis.timing_analysis || {},
        exported_at: new Date().toISOString(),
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "all-drums-timestamps.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!analysis) return null;

  const totalDrums = analysis.total_drums || 0;
  const kickCount = (analysis.kicks || []).length;
  const snareCount = (analysis.snares || []).length;
  const avgBpm = Math.round(analysis.timing_analysis?.average_bpm || 0);
  const drumsByType = analysis.drums_by_type || {};

  return (
    <Box className={styles.percussionResults}>
      {session_id && (
        <Paper elevation={3} className={styles.playerContainer}>
          <Box className={styles.playerHeader}>
            <Typography variant="h5" className={styles.playerTitle}>
              Separated Tracks
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your music has been successfully separated into individual stems
            </Typography>
          </Box>

          <Box className={styles.mainControls}>
            <Box className={styles.playbackControls}>
              <IconButton
                onClick={togglePlayPause}
                className={styles.playButton}
                disabled={Object.values(loadingStates).every((l) => l)}
                size="large"
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
              <IconButton onClick={restartSong} className={styles.restartButton} size="large">
                <RefreshIcon />
              </IconButton>
            </Box>

            <Box className={styles.progressContainer}>
              <Typography className={styles.timeDisplay}>{formatTime(currentTime)}</Typography>
              <Box
                ref={progressRef}
                className={styles.progressBar}
                onClick={handleProgressClick}
                onMouseDown={handleProgressMouseDown}
              >
                <Box
                  className={styles.progressFill}
                  sx={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }}
                />
                <Box
                  className={styles.progressHandle}
                  sx={{
                    left: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
                    opacity: isDragging ? 1 : 0,
                  }}
                />
              </Box>
              <Typography className={styles.timeDisplay}>{formatTime(duration)}</Typography>
            </Box>
          </Box>

          <Grid container spacing={2} className={styles.tracksGrid}>
            {Object.entries(tracks).map(([trackType, trackUrl]) => (
              <Grid key={trackType} size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper
                  className={`${styles.trackCard} ${trackType === "drums" ? styles.analyzed : ""}`}
                  elevation={1}
                >
                  <audio
                    ref={(el) => {
                      audioRefs.current[trackType] = el;
                    }}
                    src={trackUrl}
                    preload="auto"
                    crossOrigin="anonymous"
                    onCanPlay={() => {
                      setLoadingStates((prev) => ({ ...prev, [trackType]: false }));
                    }}
                    onLoadStart={() => {
                      setLoadingStates((prev) => ({ ...prev, [trackType]: true }));
                    }}
                    onError={() => {
                      setLoadingStates((prev) => ({ ...prev, [trackType]: false }));
                    }}
                  />

                  <Box className={styles.trackHeader}>
                    <Box className={styles.trackInfo}>
                      <Typography component="span" className={styles.trackIcon}>
                        {trackInfo[trackType].icon}
                      </Typography>
                      <Typography
                        variant="subtitle1"
                        className={styles.trackName}
                        style={{ color: trackInfo[trackType].color }}
                      >
                        {trackInfo[trackType].name}
                        {loadingStates[trackType] && (
                          <Chip label="Loading..." size="small" className={styles.loadingBadge} />
                        )}
                        {trackType === "drums" && (
                          <Chip label="✓ Analyzed" size="small" className={styles.analyzedBadge} />
                        )}
                      </Typography>
                    </Box>

                    <Box className={styles.trackActions}>
                      <IconButton
                        onClick={() => toggleMute(trackType)}
                        className={`${styles.muteButton} ${mutedTracks[trackType] ? styles.muted : ""}`}
                        size="small"
                      >
                        {mutedTracks[trackType] ? (
                          <VolumeOffIcon fontSize="small" />
                        ) : (
                          <VolumeUpIcon fontSize="small" />
                        )}
                      </IconButton>
                      <IconButton
                        onClick={() => void downloadTrack(trackType)}
                        className={styles.downloadButton}
                        size="small"
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  <Box className={styles.volumeControl}>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volumes[trackType]}
                      onChange={(e) => handleVolumeChange(trackType, parseFloat(e.target.value))}
                      className={styles.volumeSlider}
                      style={{
                        background: `linear-gradient(to right, ${trackInfo[trackType].color} 0%, ${trackInfo[trackType].color} ${volumes[trackType] * 100}%, #ddd ${volumes[trackType] * 100}%, #ddd 100%)`,
                      }}
                    />
                    <Typography variant="caption" className={styles.volumeLabel}>
                      {Math.round(volumes[trackType] * 100)}%
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ textAlign: "center", mt: 2 }}>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={() => Object.keys(tracks).forEach((trackType) => void downloadTrack(trackType))}
              className={styles.downloadAllButton}
            >
              Download All Tracks
            </Button>
          </Box>
        </Paper>
      )}

      <Paper elevation={3} className={styles.resultsContainer}>
        <Typography variant="h5" className={styles.resultsTitle}>
          Analysis Results
        </Typography>

        {analysis.visualization && (
          <Box className={styles.visualizationSection}>
            <img
              src={`data:image/png;base64,${analysis.visualization}`}
              alt="Drum Analysis Visualization"
              className={styles.visualizationImage}
            />
          </Box>
        )}

        <Grid container spacing={2} className={styles.statsGrid}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Paper className={`${styles.statCard} ${styles.kick}`} elevation={0}>
              <Typography variant="h3" className={styles.statNumber}>{kickCount}</Typography>
              <Typography variant="body2" className={styles.statLabel}>KICKS</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Paper className={`${styles.statCard} ${styles.snare}`} elevation={0}>
              <Typography variant="h3" className={styles.statNumber}>{snareCount}</Typography>
              <Typography variant="body2" className={styles.statLabel}>SNARES</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Paper className={`${styles.statCard} ${styles.total}`} elevation={0}>
              <Typography variant="h3" className={styles.statNumber}>{totalDrums}</Typography>
              <Typography variant="body2" className={styles.statLabel}>TOTAL DRUMS</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Paper className={`${styles.statCard} ${styles.bpm}`} elevation={0}>
              <Typography variant="h3" className={styles.statNumber}>{avgBpm}</Typography>
              <Typography variant="body2" className={styles.statLabel}>BPM</Typography>
            </Paper>
          </Grid>
        </Grid>

        {Object.keys(drumsByType).length > 2 && (
          <Box className={styles.drumTypesSection}>
            <Typography variant="h6" className={styles.sectionTitle}>
              Drum Types Detected
            </Typography>
            <Grid container spacing={1} className={styles.drumTypesGrid}>
              {Object.entries(drumsByType).map(([type, times]) => (
                <Grid key={type} size={{ xs: 4, sm: 3, md: 2 }}>
                  <Paper className={styles.drumTypeCard} elevation={0}>
                    <Typography variant="h5" className={styles.drumTypeCount}>{times.length}</Typography>
                    <Typography variant="caption" className={styles.drumTypeName}>{type}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        <Box className={styles.downloadSection}>
          <Typography variant="h6" className={styles.sectionTitle}>
            Export Timestamps
          </Typography>
          <Box className={styles.downloadButtons}>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={downloadKickSnareJSON}
              className={`${styles.downloadButton} ${styles.kickSnare}`}
            >
              Download Kick & Snare JSON
            </Button>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={downloadAllDrumsJSON}
              className={`${styles.downloadButton} ${styles.allDrums}`}
            >
              Download All Drums JSON
            </Button>
          </Box>
        </Box>

        {avgBpm > 0 && (
          <Box className={styles.bpmInfo}>
            <Typography variant="h6" className={styles.sectionTitle}>
              BPM Analysis
            </Typography>
            <Typography variant="body1">
              <strong>Detected BPM:</strong> {avgBpm}
            </Typography>
          </Box>
        )}

        <Box className={styles.controls}>
          <Button
            variant="contained"
            onClick={() => setShowTimestamps(!showTimestamps)}
            className={styles.toggleButton}
          >
            {showTimestamps ? "Hide Timestamps" : "Show Timestamps"}
          </Button>
        </Box>

        {showTimestamps && (
          <Box className={styles.timestampsSection}>
            <Typography variant="h6" className={styles.sectionTitle}>
              All Drum Timestamps
            </Typography>
            <Grid container spacing={2} className={styles.timestampGridAll}>
              {Object.entries(drumsByType).map(([drumType, times]) => (
                <Grid key={drumType} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Box className={styles.timestampColumn}>
                    <Typography variant="subtitle1" className={styles.drumTypeHeader}>
                      {drumType.charAt(0).toUpperCase() + drumType.slice(1)} ({times.length})
                    </Typography>
                    <Box className={styles.timestampList}>
                      {times.map((time: number, index: number) => (
                        <Chip
                          key={index}
                          label={formatTimestamp(time)}
                          className={styles.timestamp}
                          size="small"
                        />
                      ))}
                      {times.length === 0 && (
                        <Typography variant="body2" className={styles.noHits}>
                          No {drumType}s detected
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
