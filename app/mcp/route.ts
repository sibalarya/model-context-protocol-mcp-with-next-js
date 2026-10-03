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

// Delhivery Mock / Manifestation
server.registerTool(
      "delhivery_shipment_manifestation",
      {
        title: "Delhivery Shipment Manifestation",
        description:
          "Mock endpoint for Delhivery shipment manifestation. Supports test_mode: success | no_rider | low_balance | timeout | malformed.",
        inputSchema: z.object({
          test_mode: z
            .enum(["success", "no_rider", "low_balance",
            "timeout", "malformed"])
            .default("success"),
          shipment: z
            .object({
              order_id: z.string(),
              pickup_location: z.string(),
              delivery_location: z.string(),
              consignee_name: z.string(),
              consignee_phone: z.string(),
              weight: z.number().optional(),
              payment_mode: z.string().optional(),
            })
            .optional(),
        }),
      },
      async (args) => {
        const mode = args.test_mode ?? "success";
        const shipment = args.shipment || {
          order_id: "mock-order-001",
          pickup_location: "Pitampura, Delhi",
          delivery_location: "Jodhpur, Rajasthan",
          consignee_name: "Test User",
          consignee_phone: "9876543210",
          weight: 1.2,
          payment_mode: "prepaid",
        };

        if (mode === "success") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  waybill: "DELHI123456789",
                  awb_number: "DELHI123456789",
                  package_type: "Surface",
                  weight: shipment.weight ?? 1.2,
                  dimensions: "30x20x10",
                  service_type: "Doc",
                  status: "Manifested",
                  pickup_date: new Date().toISOString(),
                }),
              },
            ],
          };
        }

        if (mode === "no_rider") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "no_rider_available",
                  message:
                    "No rider available for pickup right now. Please try again later or use a different slot.",
                }),
              },
            ],
          };
        }

        if (mode === "low_balance") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "low_balance",
                  message:
                    "Account balance is too low to generate a pickup. Please top up your account.",
                }),
              },
            ],
          };
        }

        if (mode === "timeout") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "timeout",
                  message:
                    "The request timed out while creating the shipment. Please retry.",
                }),
              },
            ],
          };
        }

        // malformed
        return {
          content: [
            {
              type: "text",
              text: "OKAY" // raw garbage string, not a JSON object
            },
          ],
        };
      }
    );

    // Delhivery Mock / Tracking
    server.registerTool(
      "delhivery_shipment_tracking",
      {
        title: "Delhivery Shipment Tracking",
        description:
          "Mock endpoint for Delhivery shipment tracking. Supports test_mode.",
        inputSchema: z.object({
          test_mode: z
            .enum(["success", "no_rider", "low_balance",
            "timeout", "malformed"])
            .default("success"),
          awb_number: z.string().optional(),
        }),
      },
      async (args) => {
        const mode = args.test_mode ?? "success";
        const awb = args.awb_number || "DELHI123456789";

        if (mode === "success") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  awb_number: awb,
                  status: "In Transit",
                  origin: "Delhi",
                  destination: "Jodhpur",
                  estimated_delivery: new Date(Date.now() + 86400000)
                    .toISOString(),
                  last_updated: new Date().toISOString(),
                }),
              },
            ],
          };
        }

        if (mode === "timeout") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "timeout",
                  message:
                    "Tracking request timed out. Please try again later.",
                }),
              },
            ],
          };
        }

        if (mode === "malformed") {
          return {
            content: [{ type: "text", text: "???"}],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: mode + "_by_delhivery_mock",
                message:
                  "Operation failed according to Delhivery mocked outcome: " + mode,
              }),
            },
          ],
        };
      }
    );

    // Delhivery Mock / Pickup Request
    server.registerTool(
      "delhivery_pickup_request",
      {
        title: "Delhivery Pickup Request",
        description:
          "Mock endpoint for Delhivery pickup request. Supports test_mode.",
        inputSchema: z.object({
          test_mode: z
            .enum(["success", "no_rider", "low_balance",
            "timeout", "malformed"])
            .default("success"),
          pickup: z
            .object({
              pickup_location_id: z.string(),
              address_line: z.string(),
              city: z.string(),
              state: z.string(),
              pincode: z.string(),
              scheduled_date: z.string().optional(),
            })
            .optional(),
        }),
      },
      async (args) => {
        const mode = args.test_mode ?? "success";
        if (mode === "success") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  pickup_request_id: "PICK" + Date.now().toString(),
                  status: "Scheduled",
                  eta: new Date(Date.now() + 3600000).toISOString(),
                }),
              },
            ],
          };
        }
        if (mode === "no_rider") {
          return {
            content: [
              { type: "text", text: JSON.stringify({ success: false, error: "no_rider_available" }) },
            ]
          };
        }
        if (mode === "low_balance") {
          return {
            content: [
              { type: "text", text: JSON.stringify({ success: false, error: "low_balance" }) },
            ]
          };
        }
        if (mode === "timeout") {
          return {
            content: [
              { type: "text", text: JSON.stringify({ success: false, error: "timeout" }) },
            ]
          };
        }
        // malformed
        return {
          content: [{ type: "text", text: "{ not-json }" }],
        };
      }
    );

export {
  handler as GET,
  handler as POST,
  handler as DELETE,
};
