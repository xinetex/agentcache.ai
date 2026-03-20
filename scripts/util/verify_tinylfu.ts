import { CountMinSketch } from './src/lib/structs/sketch.js';

function testSketch() {
    console.log('--- Testing Count-Min Sketch (TinyLFU) ---');

    // Width 256, Depth 4
    const sketch = new CountMinSketch(256, 4);

    const key1 = "popular_item";
    const key2 = "rare_item";

    // Add popular item 10 times
    for (let i = 0; i < 10; i++) sketch.add(key1);

    // Add rare item 1 time
    sketch.add(key2);

    const freq1 = sketch.estimate(key1);
    const freq2 = sketch.estimate(key2);

    console.log(`Frequency 'popular_item': ${freq1} (Expected >= 10)`);
    console.log(`Frequency 'rare_item':    ${freq2} (Expected >= 1)`);

    if (freq1 >= 10 && freq2 >= 1) {
        console.log('✅ Sketch Counting Logic Verified');
    } else {
        console.error('❌ Sketch Counting Logic Failed');
    }

    // Test Collision / Overestimation (Unlikely with these keys but good to check bounds)
    const err = (Math.E * 11) / 256; // Epsilon * N
    console.log(`Theoretical Error Bound: +/- ${err.toFixed(2)}`);
}

testSketch();
