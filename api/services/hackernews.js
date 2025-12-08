
export async function getTopStories() {
    try {
        const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty');
        const ids = await res.json();
        const top5 = ids.slice(0, 5);

        const stories = await Promise.all(top5.map(async (id) => {
            const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json?print=pretty`);
            return storyRes.json();
        }));

        return stories.map(s => ({
            title: s.title,
            url: s.url,
            score: s.score,
            by: s.by,
            time: new Date(s.time * 1000).toLocaleTimeString()
        }));
    } catch (err) {
        console.error("HN Fetch Error:", err);
        return [];
    }
}
