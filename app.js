const video = document.getElementById('videoFeed');
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');

let model = null;
let videoStream = null;

// Path for drawing - ensure these are at the top of the script if not already
// let path = []; // Stores all points of the current continuous line
// let currentPath = []; // This might be redundant if path is reset correctly. Let's simplify to just 'path'.
let fingerTrail = []; // Stores points [{x, y}, {x, y}, ...]
const MAX_TRAIL_LENGTH = 50; // Max points in the trail
let lastDetectionTime = 0;
const DETECTION_INTERVAL = 100; // ms, detect every 100ms (10 FPS for detection)

// Function to start the webcam
async function startWebcam() {
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user', // Use front camera
                width: { ideal: 640 }, // Request a common width
                height: { ideal: 480 } // Request a common height
            },
            audio: false
        });
        video.srcObject = videoStream;
        video.onloadedmetadata = () => {
            // Set canvas dimensions once video metadata is loaded
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            console.log(`Canvas and video dimensions set to: ${canvas.width}x${canvas.height}`);
            // Load the COCO-SSD model (moved here to ensure video is ready)
            loadModelAndStartDetection();
        };
    } catch (err) {
        console.error("Error accessing webcam: ", err);
        alert("Error accessing webcam. Please ensure you have a webcam enabled and have granted permission.");
    }
}

// Function to load the COCO-SSD model and start detection
async function loadModelAndStartDetection() {
    try {
        console.log("Loading COCO-SSD model...");
        model = await cocoSsd.load();
        console.log("COCO-SSD model loaded successfully.");

        // Start the detection loop
        detectFrame();

        // Start the drawing loop
        drawPath(); // <--- ADD THIS LINE
    } catch (err) {
        console.error("Error loading COCO-SSD model: ", err);
        alert("Error loading the object detection model. Please check the console for details.");
    }
}

async function detectFrame() {
    if (!model || !videoStream || video.paused || video.ended || video.videoWidth === 0) {
        // console.log("Model or video not ready, skipping frame detection.");
        requestAnimationFrame(detectFrame);
        return;
    }

    const currentTime = performance.now();
    if (currentTime - lastDetectionTime < DETECTION_INTERVAL) {
        requestAnimationFrame(detectFrame); // Process next frame for drawing, but skip detection
        return;
    }
    lastDetectionTime = currentTime;

    try {
        const predictions = await model.detect(video);
        // console.log(predictions); // Log all predictions for debugging

        let detectedHand = null;

        // Look for 'person' or 'hand' (COCO-SSD is more likely to find 'person')
        // We take the first one found for simplicity.
        for (let i = 0; i < predictions.length; i++) {
            if (predictions[i].class === 'person' || predictions[i].class === 'hand') { // 'hand' is optimistic for COCO-SSD
                detectedHand = predictions[i];
                break;
            }
        }

        // Attempt to find a 'sports ball' if no hand/person, as a fallback for a distinct small object
        // This is a creative fallback, might not be ideal but good for testing if hands are not detected well.
        if (!detectedHand) {
            for (let i = 0; i < predictions.length; i++) {
                if (predictions[i].class === 'sports ball') {
                    detectedHand = predictions[i];
                    // console.log("Using sports ball as proxy");
                    break;
                }
            }
        }


        if (detectedHand) {
            const [x_bbox, y_bbox, width_bbox, height_bbox] = detectedHand.bbox;

            // Heuristic for fingertip: top-middle of the bounding box
            // Adjust coordinates based on mirrored video/canvas
            const fingertipX = canvas.width - (x_bbox + width_bbox / 2); // Mirrored
            const fingertipY = y_bbox + height_bbox * 0.1; // A bit down from the top edge

            // Add to trail
            fingerTrail.push({ x: fingertipX, y: fingertipY });
            if (fingerTrail.length > MAX_TRAIL_LENGTH) {
                fingerTrail.shift(); // Keep trail length manageable
            }
            // console.log(`Fingertip estimated at: ${fingertipX.toFixed(2)}, ${fingertipY.toFixed(2)}`);
        } else {
            // If no hand is detected, we can clear the trail or let it fade.
            // For now, let's clear it to prevent drawing old points when the hand re-appears.
            // A smoother approach would be to let points fade or stop adding new segments.
            if (fingerTrail.length > 0) {
                 // Start a new path segment next time
                fingerTrail = [];
            }
        }
    } catch (err) {
        console.error("Error during detection: ", err);
    }

    requestAnimationFrame(detectFrame); // Loop for next frame
}

// Function to draw the finger trail
function drawPath() {
    // Clear the canvas for the new frame
    // Note: The canvas is mirrored via CSS, so drawing coordinates are normal
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (fingerTrail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(fingerTrail[0].x, fingerTrail[0].y);
        for (let i = 1; i < fingerTrail.length; i++) {
            ctx.lineTo(fingerTrail[i].x, fingerTrail[i].y);
        }
        ctx.strokeStyle = 'aqua'; // Pen color
        ctx.lineWidth = 5;       // Pen thickness
        ctx.lineCap = 'round';   // Smoother line ends
        ctx.lineJoin = 'round';  // Smoother line connections
        ctx.stroke();
    }

    requestAnimationFrame(drawPath); // Loop for drawing
}

// Start the webcam when the page loads
window.addEventListener('load', () => {
    startWebcam(); // Your existing function to start webcam and detection

    const clearButton = document.getElementById('clearButton');
    if (clearButton) {
        clearButton.addEventListener('click', () => {
            fingerTrail = []; // Clear the trail
            console.log("Drawing cleared by button.");
            // The canvas will automatically be cleared in the next `drawPath` animation frame
            // because `fingerTrail` is empty.
        });
    } else {
        console.error("Clear button not found");
    }
});

// Ensure other functions like startWebcam, loadModelAndStartDetection are kept.
// The detectFrame function should remain as implemented in the previous step
// (handling detection and populating fingerTrail)
// Make sure it does NOT call requestAnimationFrame(drawPath) or clear the canvas itself.
// It should only call requestAnimationFrame(detectFrame).

/*
async function detectFrame() {
    if (!model || !videoStream || video.paused || video.ended || video.videoWidth === 0) {
        requestAnimationFrame(detectFrame);
        return;
    }

    const currentTime = performance.now();
    if (currentTime - lastDetectionTime < DETECTION_INTERVAL) {
        requestAnimationFrame(detectFrame);
        return;
    }
    lastDetectionTime = currentTime;

    try {
        const predictions = await model.detect(video);
        let detectedHand = null;
        for (let i = 0; i < predictions.length; i++) {
            if (predictions[i].class === 'person' || predictions[i].class === 'hand') {
                detectedHand = predictions[i];
                break;
            }
        }
        if (!detectedHand) {
            for (let i = 0; i < predictions.length; i++) {
                if (predictions[i].class === 'sports ball') {
                    detectedHand = predictions[i];
                    break;
                }
            }
        }

        if (detectedHand) {
            const [x_bbox, y_bbox, width_bbox, height_bbox] = detectedHand.bbox;
            const fingertipX = canvas.width - (x_bbox + width_bbox / 2);
            const fingertipY = y_bbox + height_bbox * 0.1;
            fingerTrail.push({ x: fingertipX, y: fingertipY });
            if (fingerTrail.length > MAX_TRAIL_LENGTH) {
                fingerTrail.shift();
            }
        } else {
            if (fingerTrail.length > 0) {
                fingerTrail = [];
            }
        }
    } catch (err) {
        console.error("Error during detection: ", err);
    }

    requestAnimationFrame(detectFrame);
}
*/

// Ensure startWebcam function also correctly initializes things if it's not calling loadModelAndStartDetection directly
// For instance, if loadModelAndStartDetection is called from video.onloadedmetadata in startWebcam:
/*
async function startWebcam() {
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ /* ... */ //});
/*        video.srcObject = videoStream;
        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            console.log(`Canvas and video dimensions set to: ${canvas.width}x${canvas.height}`);
            loadModelAndStartDetection(); // This will now also start drawPath
        };
    } catch (err) {
        console.error("Error accessing webcam: ", err);
        alert("Error accessing webcam...");
    }
}
*/
