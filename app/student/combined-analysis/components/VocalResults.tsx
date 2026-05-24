"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  Download as DownloadIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import WaveSurferPlayer from "./WaveSurferPlayer";
import type { VocalResultsData, VocalSyllable } from "../types";

type Props = {
  data?: VocalResultsData;
  audioFile?: File | null;
};

const EMPTY_VOCAL_RESULTS: VocalResultsData = {};
const EMPTY_SYLLABLES: VocalSyllable[] = [];

export default function VocalResults({
  data = EMPTY_VOCAL_RESULTS,
  audioFile,
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const syllables = useMemo(
    () => data.syllables ?? EMPTY_SYLLABLES,
    [data.syllables],
  );
  const songTitle = data.song_info?.title || "unknown";

  const filteredSyllables = useMemo(() => {
    if (!searchTerm) return syllables;

    const normalizedSearch = searchTerm.toLowerCase();
    return syllables.filter(
      (syl: VocalSyllable) =>
        syl.syllable.toLowerCase().includes(normalizedSearch) ||
        syl.word.toLowerCase().includes(normalizedSearch),
    );
  }, [searchTerm, syllables]);

  const handleDownloadJSON = () => {
    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vocal-analysis-${songTitle}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    const csvContent = [
      ["Syllable", "Word", "Start (s)", "End (s)", "Duration (s)", "Confidence"].join(","),
      ...syllables.map((syl: VocalSyllable) =>
        [
          syl.syllable,
          syl.word,
          syl.start_time.toFixed(3),
          syl.end_time.toFixed(3),
          syl.duration.toFixed(3),
          `${(syl.confidence * 100).toFixed(1)}%`,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vocal-timestamps-${songTitle}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      {audioFile && (
        <Box sx={{ mb: 3 }}>
          <WaveSurferPlayer audioFile={audioFile} syllables={syllables} />
        </Box>
      )}

      {data.song_info && data.song_info.identified && (
        <Box sx={{ mb: 3, p: 3, bgcolor: "background.default", borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            Song Information
          </Typography>
          <Typography variant="body1">
            <strong>Title:</strong> {data.song_info.title}
          </Typography>
          <Typography variant="body1">
            <strong>Artist:</strong> {data.song_info.artist}
          </Typography>
        </Box>
      )}

      <Box sx={{ mb: 3, p: 3, bgcolor: "background.default", borderRadius: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h6">Analysis Statistics</Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadJSON}
              sx={{ borderRadius: 2 }}
            >
              JSON
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadCSV}
              sx={{ borderRadius: 2 }}
            >
              CSV
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="body2" color="text.secondary">
              Total Syllables
            </Typography>
            <Typography variant="h5" color="primary.main">
              {data.processing?.total_syllables ?? 0}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Confidence
            </Typography>
            <Typography variant="h5" color="success.main">
              {((data.processing?.confidence ?? 0) * 100).toFixed(1)}%
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Processing Time
            </Typography>
            <Typography variant="h5">
              {data.processing?.processing_time ?? 0}s
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Song Duration
            </Typography>
            <Typography variant="h5">
              {(data.timing?.song_duration ?? 0).toFixed(1)}s
            </Typography>
          </Box>
        </Box>
      </Box>

      <TextField
        fullWidth
        variant="outlined"
        placeholder="Search syllables or words..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          },
        }}
      />

      <TableContainer component={Paper} sx={{ maxHeight: 500, borderRadius: 2 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell><strong>Syllable</strong></TableCell>
              <TableCell><strong>Word</strong></TableCell>
              <TableCell align="right"><strong>Start (s)</strong></TableCell>
              <TableCell align="right"><strong>End (s)</strong></TableCell>
              <TableCell align="right"><strong>Duration (s)</strong></TableCell>
              <TableCell align="center"><strong>Confidence</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSyllables.map((syl, index) => (
              <TableRow key={index} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                <TableCell>
                  <Chip label={syl.syllable} size="small" color="primary" />
                </TableCell>
                <TableCell>{syl.word}</TableCell>
                <TableCell align="right">{syl.start_time.toFixed(3)}</TableCell>
                <TableCell align="right">{syl.end_time.toFixed(3)}</TableCell>
                <TableCell align="right">{syl.duration.toFixed(3)}</TableCell>
                <TableCell align="center">
                  <Chip
                    label={`${(syl.confidence * 100).toFixed(0)}%`}
                    size="small"
                    color={
                      syl.confidence > 0.8
                        ? "success"
                        : syl.confidence > 0.5
                          ? "warning"
                          : "error"
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredSyllables.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center" }}>
          No syllables match your search
        </Typography>
      )}
    </Box>
  );
}
