"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import {
  CheckCircle as CheckCircleIcon,
  Download as DownloadIcon,
  Error as ErrorIcon,
  GraphicEq as DrumsIcon,
  MusicNote as MusicNoteIcon,
  Refresh as RefreshIcon,
  SportsEsports as ChartIcon,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import ChartFileResults from "./ChartFileResults";
import PercussionResults from "./PercussionResults";
import VocalResults from "./VocalResults";

type Props = {
  results: any;
  onReset: () => void;
  audioFile?: File | null;
};

export default function CombinedResultsSection({
  results,
  onReset,
  audioFile,
}: Props) {
  const [activeTab, setActiveTab] = useState(0);

  const vocalSuccess = results?.vocal_analysis?.success;
  const percSuccess = results?.percussion_analysis?.success;

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleDownloadCSV = () => {
    if (!vocalSuccess) return;

    const syllables = results.vocal_analysis.data.syllables;
    const csvContent = [
      ["Syllable", "Word", "Start Time (s)", "End Time (s)", "Duration (s)", "Confidence"],
      ...syllables.map((syl: any) => [
        syl.syllable,
        syl.word,
        syl.start_time,
        syl.end_time,
        syl.duration,
        syl.confidence,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${results.filename}_vocal_analysis.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card
            sx={{
              borderRadius: 3,
              border: vocalSuccess ? "2px solid #4caf50" : "2px solid #f44336",
            }}
          >
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <MusicNoteIcon sx={{ fontSize: 40, color: "primary.main", mr: 2 }} />
                <Box>
                  <Typography variant="h6">Vocal Analysis</Typography>
                  <Chip
                    size="small"
                    icon={vocalSuccess ? <CheckCircleIcon /> : <ErrorIcon />}
                    label={vocalSuccess ? "Complete" : "Failed"}
                    color={vocalSuccess ? "success" : "error"}
                  />
                </Box>
              </Box>
              {vocalSuccess ? (
                <Box>
                  <Typography variant="h3" color="primary.main">
                    {results.summary.total_syllables}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Syllables extracted
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    sx={{ mt: 1 }}
                  >
                    Processing time: {results.vocal_analysis.data.processing.processing_time}s
                  </Typography>
                </Box>
              ) : (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {results.vocal_analysis.error}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card
            sx={{
              borderRadius: 3,
              border: percSuccess ? "2px solid #4caf50" : "2px solid #f44336",
            }}
          >
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <DrumsIcon sx={{ fontSize: 40, color: "secondary.main", mr: 2 }} />
                <Box>
                  <Typography variant="h6">Percussion Analysis</Typography>
                  <Chip
                    size="small"
                    icon={percSuccess ? <CheckCircleIcon /> : <ErrorIcon />}
                    label={percSuccess ? "Complete" : "Failed"}
                    color={percSuccess ? "success" : "error"}
                  />
                </Box>
              </Box>
              {percSuccess ? (
                <Box>
                  <Typography variant="h3" color="secondary.main">
                    {results.summary.drum_hits}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Drum hits detected
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    sx={{ mt: 1 }}
                  >
                    Session ID: {results.percussion_analysis.data.session_id.slice(0, 8)}...
                  </Typography>
                </Box>
              ) : (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {results.percussion_analysis.error}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ display: "flex", gap: 2, mb: 3, justifyContent: "center" }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={onReset}
          sx={{ borderRadius: 2 }}
        >
          Analyze Another Song
        </Button>
        {vocalSuccess && (
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadCSV}
            sx={{ borderRadius: 2 }}
          >
            Download Vocal CSV
          </Button>
        )}
      </Box>

      <Paper sx={{ borderRadius: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          centered
          sx={{
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Tab icon={<MusicNoteIcon />} label="Vocal Results" disabled={!vocalSuccess} />
          <Tab icon={<DrumsIcon />} label="Percussion Results" disabled={!percSuccess} />
          <Tab
            icon={<ChartIcon />}
            label="Chart File"
            disabled={!vocalSuccess || !percSuccess}
          />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {activeTab === 0 && vocalSuccess && (
            <VocalResults data={results.vocal_analysis.data} audioFile={audioFile} />
          )}
          {activeTab === 1 && percSuccess && (
            <PercussionResults
              analysis={results.percussion_analysis.data.analysis}
              session_id={results.percussion_analysis.data.session_id}
            />
          )}
          {activeTab === 2 && vocalSuccess && percSuccess && (
            <ChartFileResults
              vocalData={results.vocal_analysis.data}
              percussionData={results.percussion_analysis.data}
              audioFilename={audioFile?.name}
            />
          )}
        </Box>
      </Paper>
    </motion.div>
  );
}