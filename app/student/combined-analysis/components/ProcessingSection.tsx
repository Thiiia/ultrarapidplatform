"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Paper,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as HourglassEmptyIcon,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import API_CONFIG from "../config";
import type { CombinedAnalysisResults } from "../types";

const STEPS = [
  { label: "Uploading Audio", description: "Sending your file to the server..." },
  { label: "Vocal Analysis", description: "Extracting syllable timestamps (30-60s)" },
  { label: "Percussion Separation", description: "Separating drums from the mix (30-120s)" },
  { label: "Drum Analysis", description: "Analyzing percussion patterns (2-15 minutes)" },
  { label: "Complete", description: "Processing finished!" },
];

type ProcessingData = {
  file: File;
};

type Props = {
  processingData: ProcessingData;
  onComplete: (results: CombinedAnalysisResults) => void;
  onReset: () => void;
};

type StartAnalysisResponse = {
  job_id?: string;
};

type PollAnalysisResponse = {
  status?: "complete" | "failed" | string;
  result?: CombinedAnalysisResults;
  error?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown processing error";
}

export default function ProcessingSection({
  processingData,
  onComplete,
  onReset,
}: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void processAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processAudio = async () => {
    try {
      const { file } = processingData;

      setActiveStep(0);

      const formData = new FormData();
      formData.append("audio_file", file);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60_000);

      setActiveStep(1);

      const startResponse = await fetch(`${API_CONFIG.COMBINED_API_URL}/api/analyze`, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!startResponse.ok) {
        const errorText = await startResponse.text().catch(() => "Unknown error");
        throw new Error(`Server error (${startResponse.status}): ${errorText}`);
      }

      const startData = (await startResponse.json()) as StartAnalysisResponse;
      const jobId = startData.job_id;

      if (!jobId) {
        throw new Error("No job_id returned from backend");
      }

      let pollCount = 0;
      const maxPolls = 240; // ~20 min at 5s

      while (pollCount < maxPolls) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        pollCount += 1;

        const pollResponse = await fetch(
          `${API_CONFIG.COMBINED_API_URL}/api/analyze/${jobId}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (!pollResponse.ok) {
          const errorText = await pollResponse.text().catch(() => "Unknown error");
          throw new Error(`Polling error (${pollResponse.status}): ${errorText}`);
        }

        const pollData = (await pollResponse.json()) as PollAnalysisResponse;

        if (pollData.status === "complete") {
          setActiveStep(4);
          setProgress(100);

          setTimeout(() => {
            onComplete(pollData.result ?? {});
          }, 1000);

          return;
        }

        if (pollData.status === "failed") {
          throw new Error(pollData.error || "Analysis job failed");
        }

        if (pollCount < 20) {
          setActiveStep(1);
        } else if (pollCount < 40) {
          setActiveStep(2);
        } else {
          setActiveStep(3);
        }
      }

      throw new Error("Analysis timed out while waiting for completion");
    } catch (error: unknown) {
      console.error("Processing error:", error);

      let errorMessage = getErrorMessage(error);

      if (
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("Failed to fetch")
      ) {
        errorMessage =
          "Network error: Unable to reach the server. Please check your internet connection and try again.";
      } else if (errorMessage.includes("429")) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (errorMessage.includes("500")) {
        errorMessage =
          "Server error: The analysis failed. Please try again or try a different audio file.";
      }

      setError(errorMessage);
    }
  };

  useEffect(() => {
    if (activeStep > 0 && activeStep < 4) {
      const timer = setInterval(() => {
        setProgress((oldProgress) => {
          const diff = Math.random() * 6;
          return Math.min(oldProgress + diff, 95);
        });
      }, 2000);

      return () => clearInterval(timer);
    }
  }, [activeStep]);

  if (error) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <Alert
          severity="error"
          icon={<ErrorIcon />}
          action={
            <Button color="inherit" size="small" onClick={onReset}>
              Try Again
            </Button>
          }
        >
          <Typography variant="h6" gutterBottom>
            Processing Failed
          </Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Paper elevation={0} sx={{ p: 4, borderRadius: 4 }}>
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <CircularProgress size={80} thickness={4} sx={{ mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Processing Your Audio
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This may take 3-10 minutes for most songs (up to 20 minutes for very long songs)...
          </Typography>
        </Box>

        <Stepper activeStep={activeStep} orientation="vertical">
          {STEPS.map((step, index) => (
            <Step key={step.label}>
              <StepLabel
                StepIconComponent={() => {
                  if (index < activeStep) return <CheckCircleIcon color="success" />;
                  if (index === activeStep) return <CircularProgress size={24} />;
                  return <HourglassEmptyIcon color="disabled" />;
                }}
              >
                <Typography variant="h6">{step.label}</Typography>
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary">
                  {step.description}
                </Typography>
              </StepContent>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ mt: 4 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: "block", textAlign: "center" }}
          >
            {Math.round(progress)}% complete
          </Typography>
        </Box>

        <Box sx={{ mt: 4, textAlign: "center" }}>
          <Button variant="outlined" onClick={onReset} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
        </Box>
      </Paper>
    </motion.div>
  );
}
