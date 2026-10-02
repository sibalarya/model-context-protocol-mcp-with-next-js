import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const handler = createMcpHandler((server) => {
  server.registerTool(
    "gnani_speech_to_text",
    {
      title: "Gnani Speech to Text",
      description:
        "Convert an audio file into text using Gnani AI Speech-to-Text.",
      inputSchema: z.object({
        audio_url: z
          .string()
          .url()
          .describe("Public URL of the audio file to transcribe"),

        language_code: z
          .string()
          .default("en-IN")
          .describe("Language code such as en-IN or hi-IN"),

        preferred_language: z
          .string()
          .default("en-IN")
          .describe("Preferred transcription language"),
      }),
    },

    async ({ audio_url, language_code, preferred_language }) => {
      try {
        const audioResponse = await fetch(audio_url);

        if (!audioResponse.ok) {
          throw new Error(
            `Could not download audio: HTTP ${audioResponse.status}`
          );
        }

        const audioBlob = await audioResponse.blob();

        const formData = new FormData();

        formData.append("audio_file", audioBlob, "audio.wav");
        formData.append("language_code", language_code);
        formData.append("preferred_language", preferred_language);
        formData.append("format", "transcribe");
        formData.append("itn_native_numerals", "true");

        const response = await fetch(
          "https://api.vachana.ai/stt/v3",
          {
            method: "POST",
            headers: {
              "X-API-Key-ID": process.env.GNANI_API_KEY || "",
            },
            body: formData,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            `Gnani STT failed: ${response.status} ${JSON.stringify(data)}`
          );
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: data.success,
                transcript: data.transcript || "",
                request_id: data.request_id,
              }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "Unknown Gnani STT error",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "gnani_text_to_speech",
    {
      title: "Gnani Text to Speech",
      description:
        "Convert text into speech using Gnani AI Text-to-Speech.",

      inputSchema: z.object({
        text: z.string().min(1).max(5000),

        voice: z
          .string()
          .default("Karan"),
      }),
    },

    async ({ text, voice }) => {
      try {
        const response = await fetch(
          "https://api.vachana.ai/api/v1/tts/sse",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
              "X-API-Key-ID": process.env.GNANI_API_KEY || "",
            },

            body: JSON.stringify({
              audio_config: {
                bitrate: "192k",
                container: "mp3",
                encoding: "linear_pcm",
                num_channels: 1,
                sample_rate: 44100,
                sample_width: 2,
              },

              model: "vachana-voice-v3",
              text,
              voice,
            }),
          }
        );

        const responseText = await response.text();

        if (!response.ok) {
          throw new Error(
            `Gnani TTS failed: ${response.status} ${responseText}`
          );
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                audio_response: responseText,
              }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "Unknown Gnani TTS error",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
});

export { handler as GET, handler as POST, handler as DELETE };
