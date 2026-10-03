import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const handler = createMcpHandler(
  (server) => {
    // ============================================================
    // GNANI - SPEECH TO TEXT
    // ============================================================

    server.registerTool(
      "gnani_speech_to_text",
      {
        description:
          "Convert user speech/audio into text using the Gnani STT API. All voice input for Haq should pass through this tool.",
        inputSchema: {
          audio_base64: z.string().describe("Base64 encoded audio file"),
          language_code: z
            .string()
            .default("en-IN")
            .describe("Language code such as en-IN or hi-IN"),
          preferred_language: z
            .string()
            .optional()
            .describe("Preferred spoken language"),
          format: z
            .string()
            .default("transcribe")
            .describe("Gnani transcription mode"),
        },
      },
      async ({
        audio_base64,
        language_code,
        preferred_language,
        format,
      }) => {
        const apiKey = process.env.GNANI_API_KEY;

        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Gnani STT failed: GNANI_API_KEY is not configured.",
              },
            ],
          };
        }

        try {
          const audioBuffer = Buffer.from(audio_base64, "base64");

          const formData = new FormData();

          const audioBlob = new Blob([audioBuffer], {
            type: "audio/wav",
          });

          formData.append("audio_file", audioBlob, "audio.wav");
          formData.append("language_code", language_code);
          formData.append(
            "preferred_language",
            preferred_language || language_code
          );
          formData.append("format", format);
          formData.append("itn_native_numerals", "true");

          const response = await fetch(
            "https://api.vachana.ai/stt/v3",
            {
              method: "POST",
              headers: {
                "X-API-Key-ID": apiKey,
              },
              body: formData,
            }
          );

          const responseText = await response.text();

          if (!response.ok) {
            return {
              content: [
                {
                  type: "text",
                  text: `Gnani STT API error (${response.status}): ${responseText}`,
                },
              ],
            };
          }

          let data: any;

          try {
            data = JSON.parse(responseText);
          } catch {
            return {
              content: [
                {
                  type: "text",
                  text: `Gnani STT returned a non-JSON response: ${responseText}`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: data.success,
                  request_id: data.request_id,
                  transcript: data.transcript,
                }),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Gnani STT request failed: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
          };
        }
      }
    );

    // ============================================================
    // GNANI - TEXT TO SPEECH
    // ============================================================

    server.registerTool(
      "gnani_text_to_speech",
      {
        description:
          "Convert Haq's text response into speech using the Gnani TTS API.",
        inputSchema: {
          text: z.string().describe("Text to convert into speech"),
          language: z
            .string()
            .default("en-IN")
            .describe("Language for the generated speech"),
          voice: z
            .string()
            .default("Yashvi")
            .describe("Gnani voice name"),
        },
      },
      async ({ text, language, voice }) => {
        const apiKey = process.env.GNANI_API_KEY;

        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Gnani TTS failed: GNANI_API_KEY is not configured.",
              },
            ],
          };
        }

        try {
          const response = await fetch(
            "https://api.vachana.ai/api/v1/tts/sse",
            {
              method: "POST",
              headers: {
                "X-API-Key-ID": apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                audio_config: {
                  audio_encoding: "mp3",
                  sample_rate_hertz: 24000,
                },
                model: "vachana-voice-v3",
                text,
                voice,
                language,
              }),
            }
          );

          const responseText = await response.text();

          if (!response.ok) {
            return {
              content: [
                {
                  type: "text",
                  text: `Gnani TTS API error (${response.status}): ${responseText}`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  provider: "Gnani",
                  message: "Speech generated successfully.",
                  response_size: responseText.length,
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
                text: `Gnani TTS request failed: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
          };
        }
      }
    );

    // ============================================================
    // DELHIVERY - SHIPMENT MANIFESTATION MOCK
    // ============================================================

    server.registerTool(
      "delhivery_shipment_manifestation",
      {
        description:
          "Mock of Delhivery Shipment Manifestation API. Supports success, no rider, low balance, timeout and malformed responses.",
        inputSchema: {
          test_mode: z
            .enum([
              "success",
              "no_rider",
              "low_balance",
              "timeout",
              "malformed",
            ])
            .default("success"),
          shipment: z
            .record(z.any())
            .optional()
            .describe("Delhivery shipment payload"),
        },
      },
      async ({ test_mode, shipment }) => {
        if (test_mode === "timeout") {
          await new Promise((resolve) => setTimeout(resolve, 3000));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "DELHIVERY_TIMEOUT",
                  message: "Delhivery shipment manifestation timed out.",
                }),
              },
            ],
          };
        }

        if (test_mode === "malformed") {
          return {
            content: [
              {
                type: "text",
                text: "THIS_IS_NOT_VALID_DELHIVERY_JSON",
              },
            ],
          };
        }

        if (test_mode === "no_rider") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  status: "failed",
                  error: "NO_RIDER_AVAILABLE",
                  message:
                    "No delivery executive is currently available for this pickup.",
                }),
              },
            ],
          };
        }

        if (test_mode === "low_balance") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  status: "failed",
                  error: "INSUFFICIENT_BALANCE",
                  message:
                    "Client manifest charge API failed due to insufficient balance.",
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                status: "Manifested",
                provider: "Delhivery",
                waybill: "HAQ" + Date.now(),
                reference_number:
                  shipment?.reference_number || "HAQ-CLAIM-001",
                message: "Shipment successfully manifested.",
              }),
            },
          ],
        };
      }
    );

    // ============================================================
    // DELHIVERY - SHIPMENT TRACKING MOCK
    // ============================================================

    server.registerTool(
      "delhivery_shipment_tracking",
      {
        description:
          "Mock of Delhivery Shipment Tracking API.",
        inputSchema: {
          test_mode: z
            .enum([
              "success",
              "no_rider",
              "low_balance",
              "timeout",
              "malformed",
            ])
            .default("success"),
          awb_number: z.string().optional(),
        },
      },
      async ({ test_mode, awb_number }) => {
        if (test_mode === "timeout") {
          await new Promise((resolve) => setTimeout(resolve, 3000));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "DELHIVERY_TIMEOUT",
                  message: "Shipment tracking request timed out.",
                }),
              },
            ],
          };
        }

        if (test_mode === "malformed") {
          return {
            content: [
              {
                type: "text",
                text: "??? MALFORMED RESPONSE ???",
              },
            ],
          };
        }

        if (test_mode === "no_rider") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  status: "Pending",
                  error: "NO_RIDER_AVAILABLE",
                  message:
                    "No delivery executive has been assigned to this shipment.",
                  AWB: awb_number || "HAQ-DEMO-AWB",
                }),
              },
            ],
          };
        }

        if (test_mode === "low_balance") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "INSUFFICIENT_BALANCE",
                  message: "Client account balance is insufficient.",
                  AWB: awb_number || "HAQ-DEMO-AWB",
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                Shipment: {
                  Status: {
                    Status: "In Transit",
                    StatusDateTime: new Date().toISOString(),
                    StatusType: "UD",
                    StatusLocation: "Jaipur",
                    Instructions: "Shipment in transit",
                  },
                  PickUpDate: new Date().toISOString(),
                  ReferenceNo: "HAQ-CLAIM-001",
                  AWB: awb_number || "HAQ-DEMO-AWB",
                },
              }),
            },
          ],
        };
      }
    );

    // ============================================================
    // DELHIVERY - PICKUP REQUEST MOCK
    // ============================================================

    server.registerTool(
      "delhivery_pickup_request",
      {
        description:
          "Mock of Delhivery Pickup Request Creation API.",
        inputSchema: {
          test_mode: z
            .enum([
              "success",
              "no_rider",
              "low_balance",
              "timeout",
              "malformed",
            ])
            .default("success"),
          pickup: z
            .record(z.any())
            .optional()
            .describe("Delhivery pickup request payload"),
        },
      },
      async ({ test_mode, pickup }) => {
        if (test_mode === "timeout") {
          await new Promise((resolve) => setTimeout(resolve, 3000));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "DELHIVERY_TIMEOUT",
                  message: "Pickup request timed out.",
                }),
              },
            ],
          };
        }

        if (test_mode === "malformed") {
          return {
            content: [
              {
                type: "text",
                text: "{ THIS RESPONSE IS MALFORMED ",
              },
            ],
          };
        }

        if (test_mode === "no_rider") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "NO_RIDER_AVAILABLE",
                  message:
                    "No field executive is currently available for this pickup location.",
                }),
              },
            ],
          };
        }

        if (test_mode === "low_balance") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "INSUFFICIENT_BALANCE",
                  message:
                    "Pickup request could not be created because the client balance is insufficient.",
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                status: "Pickup Scheduled",
                pickup_request_id: "PUR-" + Date.now(),
                pickup_location:
                  pickup?.pickup_location || "Haq Claim Pickup Location",
                pickup_date:
                  pickup?.pickup_date ||
                  new Date().toISOString().slice(0, 10),
                message: "Pickup request created successfully.",
              }),
            },
          ],
        };
      }
    );
  },
  {},
  {
    basePath: "/mcp",
    maxDuration: 60,
    verboseLogs: true,
  }
);

export {
  handler as GET,
  handler as POST,
  handler as DELETE,
};
