import React, { memo } from 'react';
import { BaseEdge, getBezierPath, EdgeLabelRenderer } from 'reactflow';
import './TrafficEdge.css';

const TrafficEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
}) => {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    // Data contains traffic info: { packets: [{ id, type, progress, speed }] }
    const packets = data?.packets || [];

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />

            {/* Render packets moving along the path */}
            {packets.map((packet) => (
                <circle
                    key={packet.id}
                    r="4"
                    className={`traffic-packet ${packet.type}`}
                >
                    <animateMotion
                        dur={`${packet.speed}s`}
                        repeatCount="1"
                        path={edgePath}
                        begin="0s"
                        fill="freeze"
                    />
                </circle>
            ))}
        </>
    );
};

export default memo(TrafficEdge);
