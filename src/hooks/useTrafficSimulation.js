import { useState, useEffect, useCallback, useRef } from 'react';

export function useTrafficSimulation(nodes, edges) {
    const [trafficState, setTrafficState] = useState({});
    const requestRef = useRef();

    // Simulation parameters
    const PACKET_CHANCE = 0.05; // Chance per frame to spawn a packet
    const SPEED_HIT = 1.0; // Seconds to traverse
    const SPEED_MISS = 2.5; // Seconds to traverse (slower)

    const simulate = useCallback(() => {
        setTrafficState(prevState => {
            const newState = { ...prevState };
            const now = Date.now();

            // 1. Spawn new packets at source nodes
            const sourceNodes = nodes.filter(n => n.type === 'input' || n.type === 'source');

            sourceNodes.forEach(node => {
                if (Math.random() < PACKET_CHANCE) {
                    // Find outgoing edges
                    const outgoingEdges = edges.filter(e => e.source === node.id);
                    outgoingEdges.forEach(edge => {
                        if (!newState[edge.id]) newState[edge.id] = [];

                        newState[edge.id].push({
                            id: `pkt-${now}-${Math.random()}`,
                            type: 'request', // initial request
                            startTime: now,
                            speed: SPEED_MISS, // default speed
                            progress: 0
                        });
                    });
                }
            });

            // 2. Update existing packets and propagate
            Object.keys(newState).forEach(edgeId => {
                const edge = edges.find(e => e.id === edgeId);
                if (!edge) {
                    delete newState[edgeId];
                    return;
                }

                const packets = newState[edgeId] || [];
                const remainingPackets = [];

                packets.forEach(packet => {
                    const elapsed = (now - packet.startTime) / 1000; // seconds
                    const progress = elapsed / packet.speed;

                    if (progress >= 1) {
                        // Packet reached destination
                        // Trigger logic for next hop
                        const targetNode = nodes.find(n => n.id === edge.target);
                        if (targetNode) {
                            // Determine outcome based on node type
                            let nextType = packet.type;
                            let nextSpeed = packet.speed;

                            if (targetNode.type.startsWith('cache_')) {
                                // Simulate cache hit/miss
                                const isHit = Math.random() > 0.3; // 70% hit rate
                                nextType = isHit ? 'hit' : 'miss';
                                nextSpeed = isHit ? SPEED_HIT : SPEED_MISS;
                            }

                            // Propagate to next edges
                            const nextEdges = edges.filter(e => e.source === targetNode.id);
                            nextEdges.forEach(nextEdge => {
                                if (!newState[nextEdge.id]) newState[nextEdge.id] = [];
                                newState[nextEdge.id].push({
                                    id: `pkt-${now}-${Math.random()}`,
                                    type: nextType,
                                    startTime: now,
                                    speed: nextSpeed,
                                    progress: 0
                                });
                            });
                        }
                    } else {
                        // Keep packet
                        remainingPackets.push(packet);
                    }
                });

                newState[edgeId] = remainingPackets;
            });

            return newState;
        });

        requestRef.current = requestAnimationFrame(simulate);
    }, [nodes, edges]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(simulate);
        return () => cancelAnimationFrame(requestRef.current);
    }, [simulate]);

    return trafficState;
}
