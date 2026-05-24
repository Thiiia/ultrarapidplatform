"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  Download as DownloadIcon,
  SportsEsports as GameIcon,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import API_CONFIG from "../config";
import type { PercussionResultsData, VocalResultsData } from "../types";

type Props = {
  vocalData: VocalResultsData;
  percussionData: PercussionResultsData;
  audioFilename?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to generate chart";
}

export default function ChartFileResults({
  vocalData,
  percussionData,
  audioFilename,
}: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateChart = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      const response = await fetch(`${API_CONFIG.COMBINED_API_URL}/api/generate-chart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vocal_data: vocalData,
          percussion_data: percussionData,
          filename: audioFilename || "song.mp3",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate chart file");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${audioFilename?.replace(/\.[^/.]+$/, "") || "song"}.chart`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      console.error("Chart generation error:", error);
      setError(getErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const totalSyllables = vocalData.processing?.total_syllables || 0;
  const drumHits = percussionData.analysis?.total_drums || 0;
  const bpm = percussionData.analysis?.timing_analysis?.average_bpm || 0;
  const duration = vocalData.timing?.song_duration || 0;

  return (
    <Box>
      <Paper
        elevation={0}
        sx={{
          p: 4,
          mb: 3,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          borderRadius: 3,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <GameIcon sx={{ fontSize: 40 }} />
          <Box>
            <Typography variant="h4" gutterBottom>
              Generate Chart File
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Create a playable rhythm game chart from your audio analysis
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Chart Information
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          This generates a .chart file compatible with Clone Hero and other Guitar Hero-style rhythm games.
          The chart uses a 5-lane layout mapped to your audio analysis:
        </Typography>

        <Stack spacing={1.5} sx={{ mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Chip label="Lane 0" sx={{ bgcolor: "#22c55e", color: "white", fontWeight: "bold", minWidth: 80 }} />
            <Typography variant="body2">
              <strong>Green:</strong> Vocals/Syllables (distributed ~{Math.ceil(totalSyllables / 3)} notes)
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Chip label="Lane 1" sx={{ bgcolor: "#ef4444", color: "white", fontWeight: "bold", minWidth: 80 }} />
            <Typography variant="body2">
              <strong>Red:</strong> Vocals/Syllables (distributed ~{Math.ceil(totalSyllables / 3)} notes)
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Chip label="Lane 2" sx={{ bgcolor: "#eab308", color: "white", fontWeight: "bold", minWidth: 80 }} />
            <Typography variant="body2">
              <strong>Yellow:</strong> Vocals/Syllables (distributed ~{Math.floor(totalSyllables / 3)} notes)
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Chip label="Lane 3" sx={{ bgcolor: "#3b82f6", color: "white", fontWeight: "bold", minWidth: 80 }} />
            <Typography variant="body2">
              <strong>Blue:</strong> Kick Drums ({percussionData?.analysis?.kicks?.length || 0} notes)
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Chip label="Lane 4" sx={{ bgcolor: "#f97316", color: "white", fontWeight: "bold", minWidth: 80 }} />
            <Typography variant="body2">
              <strong>Orange:</strong> Snare Drums ({percussionData?.analysis?.snares?.length || 0} notes)
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 2,
            mb: 3,
          }}
        >
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Notes
              </Typography>
              <Typography variant="h5" color="primary">
                {totalSyllables + drumHits}
              </Typography>
            </CardContent>
          </Card>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                BPM
              </Typography>
              <Typography variant="h5" color="primary">
                {bpm.toFixed(1)}
              </Typography>
            </CardContent>
          </Card>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Duration
              </Typography>
              <Typography variant="h5" color="primary">
                {duration.toFixed(1)}s
              </Typography>
            </CardContent>
          </Card>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Difficulties
              </Typography>
              <Typography variant="h5" color="primary">
                4
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Easy to Expert
              </Typography>
            </CardContent>
          </Card>
        </Box>

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={
              isGenerating ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />
            }
            onClick={handleGenerateChart}
            disabled={isGenerating}
            sx={{
              py: 1.5,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              "&:hover": {
                background: "linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)",
              },
            }}
            fullWidth
          >
            {isGenerating ? "Generating Chart..." : "Download .chart File"}
          </Button>
        </motion.div>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 3, borderRadius: 2, bgcolor: "background.default" }}>
        <Typography variant="h6" gutterBottom>
          How to Use
        </Typography>
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" gutterBottom>
              <strong>1. Download the chart file</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
              Click the button above to generate and download your .chart file
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" gutterBottom>
              <strong>2. Place files in Clone Hero</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
              Create a new folder in your Clone Hero songs directory with both the .chart file and the audio file
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" gutterBottom>
              <strong>3. Play your custom chart!</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
              Launch Clone Hero, refresh your song library, and enjoy playing your analysis as a rhythm game
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
