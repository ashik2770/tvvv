const express = require("express");
const request = require("request");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("../public"));

// GitHub থেকে JSON ডেটার URL
const jsonUrl = "https://raw.githubusercontent.com/byte-capsule/Toffee-Channels-Link-Headers/main/toffee_channels.json";

// চ্যানেল ডেটা ক্যাশে রাখার জন্য
let channelCache = null;
let lastFetched = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 ঘণ্টার ক্যাশ

// চ্যানেল ডেটা ফেচ করা
async function fetchChannelData() {
    const now = Date.now();
    if (channelCache && (now - lastFetched) < CACHE_DURATION) {
        return channelCache; // ক্যাশ থেকে রিটার্ন
    }

    try {
        const response = await fetch(jsonUrl);
        const data = await response.json();
        channelCache = data;
        lastFetched = now;
        return data;
    } catch (error) {
        console.error("Error fetching channel data:", error);
        throw error;
    }
}

// API: চ্যানেল তালিকা
app.get("/api/channels", async (req, res) => {
    try {
        const data = await fetchChannelData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch channels" });
    }
});

// API: স্ট্রিম প্রক্সি
app.get("/api/stream", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send("URL is required");

    try {
        // JSON থেকে চ্যানেল ডেটা ফেচ করা
        const channels = await fetchChannelData();
        
        // URL-এর জন্য ম্যাচিং চ্যানেল খুঁজে বের করা
        const channel = channels.find(ch => ch.link === url);
        if (!channel) {
            return res.status(404).send("Channel not found");
        }

        // JSON থেকে গতিশীল হেডার সংগ্রহ
        const headers = channel.headers || {
            "Host": new URL(url).hostname, // URL থেকে Host সংগ্রহ
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "cookie": "" // ডিফল্ট কুকি, JSON থেকে ওভাররাইড হবে
        };

        // হেডারগুলো কনফার্ম করা
        console.log(`Streaming ${url} with headers:`, headers);

        // স্ট্রিম রিকোয়েস্ট
        request({
            url,
            headers,
            method: "GET",
            timeout: 10000 // 10 সেকেন্ড টাইমআউট
        })
            .on("response", (response) => {
                if (response.statusCode !== 200) {
                    res.status(response.statusCode).send("Stream unavailable");
                }
            })
            .pipe(res)
            .on("error", (err) => {
                console.error("Stream error:", err);
                res.status(500).send("Stream error");
            });
    } catch (error) {
        console.error("Error in stream:", error);
        res.status(500).send("Internal server error");
    }
});

// সার্ভার শুরু
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
