"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Container,
  Typography,
  AppBar,
  Toolbar,
  Fab,
  Zoom,
  useScrollTrigger,
} from "@mui/material";
import {
  GraphicEq as GraphicEqIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  MusicNote as MusicNoteIcon,
  Album as DrumsIcon,
} from "@mui/icons-material";
import { motion } from "framer-motion";

import UploadSection from "./components/UploadSection";
import ProcessingSection from "./components/ProcessingSection";
import type { CombinedAnalysisResults } from "./types";

function ScrollTop({ children }: { children: React.ReactNode }) {
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 100,
  });

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Zoom in={trigger}>
      <Box
        onClick={handleClick}
        role="presentation"
        sx={{ position: "fixed", bottom: 16, right: 16 }}
      >
        {children}
      </Box>
    </Zoom>
  );
}

type ProcessingData = {
  file: File;
} | null;

type EditorAnalysisMetadata = {
  songTitle: string;
  artist: string;
  bpm: number;
  durationSeconds: number;
  vocalSyllableCount: number;
  percussionHitCount: number;
  uploadedFileName: string;
};

type EditorRedirectPayload = {
  chartFile: string;
  analysisMetadata: EditorAnalysisMetadata;
  rawResults: CombinedAnalysisResults;
};

function getEditorRedirectPayload(
  nextResults: CombinedAnalysisResults,
  processingData: ProcessingData
): EditorRedirectPayload {
  const chartFile =
    nextResults?.chart_file ??
    nextResults?.chartFile ??
    nextResults?.results?.chart_file ??
    "";

  const vocalSyllables =
    nextResults?.vocal_analysis?.syllables ??
    nextResults?.results?.vocal_analysis?.syllables ??
    [];

  const drumHits =
    nextResults?.percussion_analysis?.drum_hits ??
    nextResults?.results?.percussion_analysis?.drum_hits ??
    [];

  const analysisMetadata: EditorAnalysisMetadata = {
    songTitle:
      nextResults?.song_title ??
      nextResults?.songTitle ??
      nextResults?.metadata?.song_title ??
      processingData?.file?.name?.replace(/\.[^/.]+$/, "") ??
      "Untitled Song",
    artist:
      nextResults?.artist ??
      nextResults?.metadata?.artist ??
      "Unknown Artist",
    bpm:
      Number(
        nextResults?.bpm ??
          nextResults?.metadata?.bpm ??
          nextResults?.results?.bpm
      ) || 120,
    durationSeconds:
      Number(
        nextResults?.duration_seconds ??
          nextResults?.durationSeconds ??
          nextResults?.metadata?.duration_seconds ??
          nextResults?.results?.duration_seconds
      ) || 0,
    vocalSyllableCount: Array.isArray(vocalSyllables) ? vocalSyllables.length : 0,
    percussionHitCount: Array.isArray(drumHits) ? drumHits.length : 0,
    uploadedFileName: processingData?.file?.name ?? "",
  };

  return {
    chartFile,
    analysisMetadata,
    rawResults: nextResults,
  };
}

export default function CombinedAnalysisPage() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<"upload" | "processing" | "results">("upload");
  const [processingData, setProcessingData] = useState<ProcessingData>(null);

  const handleFileUpload = (file: File) => {
    setCurrentStep("processing");
    setProcessingData({ file });
  };

  const handleProcessingComplete = (nextResults: CombinedAnalysisResults) => {
    const editorPayload = getEditorRedirectPayload(nextResults, processingData);

    sessionStorage.setItem(
      "ultrarapid_editor_payload",
      JSON.stringify(editorPayload)
    );

    router.replace("/editor");
  };

  const handleReset = () => {
    setCurrentStep("upload");
    setProcessingData(null);
    sessionStorage.removeItem("ultrarapid_editor_payload");
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
        }}
      >
        <Toolbar>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            style={{ display: "flex", alignItems: "center", flexGrow: 1 }}
          >
            <GraphicEqIcon sx={{ mr: 2, color: "primary.main", fontSize: 32 }} />
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontWeight: 700,
                color: "text.primary",
                background: "linear-gradient(45deg, #667eea 30%, #764ba2 90%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Combined Audio Analysis
            </Typography>
          </motion.div>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", mr: 2 }}>
              <MusicNoteIcon sx={{ color: "text.secondary", fontSize: 20, mr: 0.5 }} />
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Vocals
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", mr: 2 }}>
              <DrumsIcon sx={{ color: "text.secondary", fontSize: 20, mr: 0.5 }} />
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Percussion
              </Typography>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Box textAlign="center" mb={6}>
            <Typography
              variant="h1"
              component="h1"
              gutterBottom
              sx={{
                background: "linear-gradient(45deg, #667eea 30%, #764ba2 90%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                mb: 2,
              }}
            >
              Complete Audio Analysis
            </Typography>
            <Typography
              variant="h5"
              color="text.secondary"
              sx={{ maxWidth: 800, mx: "auto", fontWeight: 400 }}
            >
              Get vocal syllable timestamps and percussion analysis in one go
            </Typography>
            <Box sx={{ mt: 3, display: "flex", justifyContent: "center", gap: 4 }}>
              <Box>
                <MusicNoteIcon sx={{ fontSize: 40, color: "primary.main" }} />
                <Typography variant="body2" color="text.secondary">
                  Syllable Extraction
                </Typography>
              </Box>
              <Box>
                <DrumsIcon sx={{ fontSize: 40, color: "secondary.main" }} />
                <Typography variant="body2" color="text.secondary">
                  Drum Analysis
                </Typography>
              </Box>
            </Box>
          </Box>
        </motion.div>

        {currentStep === "upload" && (
          <UploadSection onFileUpload={handleFileUpload} />
        )}

        {currentStep === "processing" && processingData && (
          <ProcessingSection
            processingData={processingData}
            onComplete={handleProcessingComplete}
            onReset={handleReset}
          />
        )}
      </Container>

      <Box
        component="footer"
        sx={{
          py: 4,
          px: 2,
          mt: 8,
          borderTop: "1px solid rgba(0, 0, 0, 0.08)",
          bgcolor: "background.paper",
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" align="center">
            © Thiiia
          </Typography>
        </Container>
      </Box>

      <ScrollTop>
        <Fab color="primary" size="small" aria-label="scroll back to top">
          <KeyboardArrowUpIcon />
        </Fab>
      </ScrollTop>
    </Box>
  );
}
