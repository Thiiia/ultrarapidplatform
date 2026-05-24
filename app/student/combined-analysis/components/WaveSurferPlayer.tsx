"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Chip,
  IconButton,
  Paper,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import {
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  VolumeUp as VolumeIcon,
} from "@mui/icons-material";
import WaveSurfer from "wavesurfer.js";

type Syllable = {
  syllable: string;
  word: string;
  start_time: number;
  end_time: number;
  duration: number;
  confidence: number;
};

type Props = {
  audioFile?: File | null;
  syllables?: Syllable[];
};

export default function WaveSurferPlayer({
  audioFile,
  syllables = [],
}: Props) {
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const syllablesRef = useRef<Syllable[]>(syllables);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [currentSyllable, setCurrentSyllable] = useState<Syllable | null>(null);

  useEffect(() => {
    syllablesRef.current = syllables;
  }, [syllables]);

  useEffect(() => {
    if (waveformRef.current && audioFile) {
      try {
        const instance = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: "#3f51b5",
          progressColor: "#1976d2",
          cursorColor: "#ff5722",
          barWidth: 2,
          barRadius: 3,
          height: 80,
          normalize: true,
          mediaControls: false,
        });
        wavesurfer.current = instance;

        const audioUrl = URL.createObjectURL(audioFile);
        instance.load(audioUrl);

        instance.on("ready", () => {
          setDuration(instance.getDuration());
          instance.setVolume(volume);
        });

        instance.on("audioprocess", () => {
          const time = instance.getCurrentTime();
          setCurrentTime(time);

          const current =
            syllablesRef.current.find(
              (syl) => time >= syl.start_time && time <= syl.end_time,
            ) || null;

          setCurrentSyllable((prev: Syllable | null) => {
            if (prev?.start_time !== current?.start_time) return current;
            return prev;
          });
        });

        instance.on("seeking", () => {
          const time = instance.getCurrentTime();
          setCurrentTime(time);

          const current =
            syllablesRef.current.find(
              (syl) => time >= syl.start_time && time <= syl.end_time,
            ) || null;

          setCurrentSyllable(current);
        });

        instance.on("play", () => setIsPlaying(true));
        instance.on("pause", () => setIsPlaying(false));
        instance.on("finish", () => setIsPlaying(false));

        return () => {
          if (wavesurfer.current) {
            wavesurfer.current.pause();
            wavesurfer.current.destroy();
          }
          URL.revokeObjectURL(audioUrl);
        };
      } catch (error) {
        console.error("Error initializing WaveSurfer:", error);
      }
    }
  }, [audioFile, volume]);

  const handlePlayPause = () => {
    if (wavesurfer.current) wavesurfer.current.playPause();
  };

  const handleSeek = (_event: Event, newValue: number | number[]) => {
    if (wavesurfer.current && typeof newValue === "number" && duration > 0) {
      const seekTime = (newValue / 100) * duration;
      wavesurfer.current.seekTo(seekTime / duration);
    }
  };

  const handleVolumeChange = (_event: Event, newValue: number | number[]) => {
    if (typeof newValue !== "number") return;
    setVolume(newValue / 100);
    if (wavesurfer.current) {
      wavesurfer.current.setVolume(newValue / 100);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!audioFile) return null;

  return (
    <Paper elevation={0} sx={{ p: 3, bgcolor: "background.default", borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom>
        Audio Player & Waveform
      </Typography>

      <Box
        ref={waveformRef}
        sx={{
          width: "100%",
          mb: 2,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          p: 1,
        }}
      />

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <IconButton
          onClick={handlePlayPause}
          color="primary"
          size="large"
          sx={{
            bgcolor: "primary.light",
            "&:hover": { bgcolor: "primary.main", color: "white" },
          }}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </IconButton>

        <Typography variant="body2" sx={{ minWidth: 50 }}>
          {formatTime(currentTime)}
        </Typography>

        <Slider
          value={(currentTime / duration) * 100 || 0}
          onChange={handleSeek}
          sx={{ flexGrow: 1 }}
          size="small"
        />

        <Typography variant="body2" sx={{ minWidth: 50 }}>
          {formatTime(duration)}
        </Typography>

        <VolumeIcon />
        <Slider
          value={volume * 100}
          onChange={handleVolumeChange}
          sx={{ width: 100 }}
          size="small"
        />
      </Stack>

      <Box sx={{ minHeight: 60, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Current Syllable:
        </Typography>
        {currentSyllable ? (
          <Chip
            label={`"${currentSyllable.syllable}" (${currentSyllable.word}) - ${currentSyllable.start_time.toFixed(2)}s`}
            color="primary"
            variant="outlined"
          />
        ) : (
          <Chip
            label="No syllable detected"
            color="default"
            variant="outlined"
            sx={{ opacity: 0.5 }}
          />
        )}
      </Box>
    </Paper>
  );
}
