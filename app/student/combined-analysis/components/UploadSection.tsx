"use client";

import { useRef, useState } from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import {
  AudioFile as AudioFileIcon,
  CloudUpload as CloudUploadIcon,
} from "@mui/icons-material";
import { motion } from "framer-motion";

type Props = {
  onFileUpload: (file: File) => void;
};

export default function UploadSection({ onFileUpload }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("audio/")) {
      alert("Please upload an audio file");
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (selectedFile) {
      onFileUpload(selectedFile);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 6,
          borderRadius: 4,
          border: "2px dashed",
          borderColor: dragActive ? "primary.main" : "divider",
          bgcolor: dragActive ? "action.hover" : "background.paper",
          transition: "all 0.3s ease",
          textAlign: "center",
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleChange}
          style={{ display: "none" }}
        />

        {!selectedFile ? (
          <>
            <CloudUploadIcon
              sx={{
                fontSize: 80,
                color: "primary.main",
                mb: 2,
                opacity: dragActive ? 1 : 0.7,
              }}
            />
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
              Upload Audio File
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Drag and drop your audio file here, or click to browse
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<CloudUploadIcon />}
              onClick={handleButtonClick}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 2,
                textTransform: "none",
                fontSize: "1.1rem",
              }}
            >
              Choose File
            </Button>
            <Typography
              variant="caption"
              display="block"
              sx={{ mt: 3, color: "text.secondary" }}
            >
              Supported formats: MP3, WAV, FLAC, M4A, OGG
            </Typography>
          </>
        ) : (
          <Box>
            <AudioFileIcon
              sx={{
                fontSize: 80,
                color: "success.main",
                mb: 2,
              }}
            />
            <Typography variant="h6" gutterBottom>
              {selectedFile.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
            </Typography>
            <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
              <Button
                variant="outlined"
                onClick={() => setSelectedFile(null)}
                sx={{ borderRadius: 2 }}
              >
                Change File
              </Button>
              <Button
                variant="contained"
                onClick={handleUpload}
                sx={{
                  px: 4,
                  borderRadius: 2,
                  textTransform: "none",
                }}
              >
                Start Combined Analysis
              </Button>
            </Box>
            <Box sx={{ mt: 4, p: 3, bgcolor: "info.lighter", borderRadius: 2 }}>
              <Typography
                variant="body2"
                color="info.main"
                fontWeight={600}
                gutterBottom
              >
                This will perform both:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ✓ Vocal Syllable Extraction (30-60 seconds)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ✓ Percussion Analysis (2-15 minutes)
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>
    </motion.div>
  );
}