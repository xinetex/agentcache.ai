/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { z } from 'zod';

/**
 * Robotics Sector Ontology
 * Aligned with ROS/IEEE vocabulary for autonomous systems interop.
 * Covers: sensor readings, kinematics, environment maps, task plans.
 */

export const SensorReadingSchema = z.object({
    sensorType: z.enum(['lidar', 'camera', 'imu', 'gps', 'ultrasonic', 'force_torque', 'thermal', 'depth']),
    frame: z.string().describe("Coordinate frame (e.g., base_link, world)"),
    dataFormat: z.string().describe("Data encoding (e.g., pointcloud2, image/rgb8, twist)"),
    frequency_hz: z.number().optional(),
    range: z.object({
        min: z.number(),
        max: z.number(),
    }).optional(),
});

export const KinematicsSchema = z.object({
    dof: z.number().describe("Degrees of freedom"),
    jointTypes: z.array(z.enum(['revolute', 'prismatic', 'fixed', 'continuous', 'floating'])),
    endEffector: z.string().optional().describe("End-effector type (e.g., gripper, welding_torch)"),
    payload_kg: z.number().optional(),
    reach_m: z.number().optional(),
});

export const TaskPlanSchema = z.object({
    taskId: z.string(),
    taskType: z.enum(['navigation', 'manipulation', 'inspection', 'assembly', 'mapping', 'surveillance']),
    priority: z.enum(['critical', 'high', 'normal', 'low']),
    constraints: z.array(z.string()).optional().describe("Safety or operational constraints"),
    estimatedDuration_s: z.number().optional(),
});

export const RoboticsOntology = z.object({
    systemName: z.string(),
    platformType: z.enum(['mobile_robot', 'manipulator', 'drone', 'humanoid', 'autonomous_vehicle', 'collaborative_robot', 'swarm_unit']),
    manufacturer: z.string().nullable(),
    operatingEnvironment: z.enum(['indoor', 'outdoor', 'underwater', 'aerial', 'space', 'hazardous']),
    sensors: z.array(SensorReadingSchema),
    kinematics: KinematicsSchema.optional(),
    activeTasks: z.array(TaskPlanSchema).optional(),
    autonomyLevel: z.enum(['teleoperated', 'semi_autonomous', 'supervised_autonomous', 'fully_autonomous']),
    safetyRating: z.string().nullable().describe("ISO 10218 / ISO 13482 classification"),
    rosVersion: z.string().optional().describe("ROS version (e.g., ROS2 Humble)"),
});

export const ROBOTICS_VOCABULARY = {
    canonicalTerms: ['hazard', 'obstacle', 'navigation', 'payload', 'autonomy', 'sensor', 'actuator'],
    sectorId: 'robotics',
    version: '1.0.0',
} as const;
