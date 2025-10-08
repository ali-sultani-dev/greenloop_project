-- GreenLoop Database Schema - Initial Seed Data
-- This script populates the database with initial categories, actions, and badges

-- =============================================
-- ACTION CATEGORIES
-- =============================================

INSERT INTO public.action_categories (name, description, icon, color) VALUES
('Transportation', 'Sustainable transportation choices', '🚲', '#10B981'),
('Energy', 'Energy conservation and renewable energy', '⚡', '#F59E0B'),
('Waste Reduction', 'Reducing, reusing, and recycling waste', '♻️', '#8B5CF6'),
('Water Conservation', 'Conserving water resources', '💧', '#06B6D4'),
('Food & Diet', 'Sustainable food choices and practices', '🌱', '#84CC16'),
('Office Practices', 'Sustainable workplace behaviors', '🏢', '#6366F1'),
('Community', 'Community engagement and education', '🤝', '#EC4899'),
('Digital', 'Digital sustainability practices', '💻', '#14B8A6')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- SUSTAINABILITY ACTIONS
-- =============================================

-- Transportation Actions
INSERT INTO public.sustainability_actions (category_id, title, description, points_value, co2_impact, difficulty_level, estimated_time_minutes, instructions) 
SELECT 
  ac.id,
  'Bike to Work',
  'Choose cycling over driving for your commute',
  50,
  2.5,
  2,
  30,
  'Plan your route, check weather conditions, and ensure your bike is in good condition. Track your distance and share a photo of your bike at the office.'
FROM public.action_categories ac WHERE ac.name = 'Transportation';

INSERT INTO public.sustainability_actions (category_id, title, description, points_value, co2_impact, difficulty_level, estimated_time_minutes, instructions) 
SELECT 
  ac.id,
  'Use Public Transportation',
  'Take public transit instead of driving',
  30,
  1.8,
  1,
  15,
  'Plan your route using public transit apps. Take a photo of your transit ticket or pass as verification.'
FROM public.action_categories ac WHERE ac.name = 'Transportation';

INSERT INTO public.sustainability_actions (category_id, title, description, points_value, co2_impact, difficulty_level, estimated_time_minutes, instructions) 
SELECT 
  ac.id,
  'Carpool with Colleagues',
  'Share a ride with coworkers to reduce emissions',
  40,
  2.0,
  2,
  20,
  'Coordinate with colleagues to arrange carpooling. Document the shared ride with a group photo or screenshot of carpool app.'
FROM public.action_categories ac WHERE ac.name = 'Transportation';

-- Energy Actions
INSERT INTO public.sustainability_actions (category_id, title, description, points_value, co2_impact, difficulty_level, estimated_time_minutes, instructions) 
SELECT 
  ac.id,
  'Unplug Devices When Not in Use',
  'Reduce phantom energy consumption by unplugging electronics',
  20,
  0.5,
  1,
  5,
  'Identify devices that consume standby power and unplug them when not needed. Take a photo of unplugged devices.'
FROM public.action_categories ac WHERE ac.name = 'Energy';

INSERT INTO public.sustainability_actions (category_id, title, description, points_value, co2_impact, difficulty_level, estimated_time_minutes, instructions) 
SELECT 
  ac.id,
  'Switch to LED Bulbs',
  'Replace incandescent bulbs with energy-efficient LEDs',
  60,
  3.2,
  2,
  15,
  'Purchase LED bulbs and replace old incandescent ones. Take before and after photos of the bulb replacement.'
FROM public.action_categories ac WHERE ac.name = 'Energy';

-- Waste Reduction Actions
INSERT INTO public.sustainability_actions (category_id, title, description, points_value, co2_impact, difficulty_level, estimated_time_minutes, instructions) 
SELECT 
  ac.id,
  'Bring Reusable Water Bottle',
  'Use a reusable water bottle instead of single-use plastic',
  25,
  0.3,
  1,
  2,
  'Bring your reusable water bottle to work and refill it throughout the day. Take a photo of your bottle at your workspace.'
FROM public.action_categories ac WHERE ac.name = 'Waste Reduction';

INSERT INTO public.sustainability_actions (category_id, title, description, points_value, co2_impact, difficulty_level, estimated_time_minutes, instructions) 
SELECT 
  ac.id,
  'Recycle Office Paper',
  'Properly sort and recycle paper waste',
  15,
  0.2,
  1,
  5,
  'Collect paper waste and place it in designated recycling bins. Take a photo of the sorted recyclables.'
FROM public.action_categories ac WHERE ac.name = 'Waste Reduction';

-- Water Conservation Actions
INSERT INTO public.sustainability_actions (category_id, title, description, points_value, co2_impact, difficulty_level, estimated_time_minutes, instructions) 
SELECT 
  ac.id,
  'Take Shorter Showers',
  'Reduce shower time to conserve water',
  35,
  1.1,
  2,
  10,
  'Time your shower and aim to reduce it by 2-3 minutes. Use a timer app and screenshot your improved time.'
FROM public.action_categories ac WHERE ac.name = 'Water Conservation';

-- Food & Diet Actions
INSERT INTO public.sustainability_actions (category_id, title, description, points_value, co2_impact, difficulty_level, estimated_time_minutes, instructions) 
SELECT 
  ac.id,
  'Choose Plant-Based Lunch',
  'Opt for a vegetarian or vegan meal',
  45,
  2.8,
  2,
  30,
  'Select a plant-based meal for lunch. Take a photo of your meal and share what you chose.'
FROM public.action_categories ac WHERE ac.name = 'Food & Diet';

INSERT INTO public.sustainability_actions (category_id, title, description, points_value, co2_impact, difficulty_level, estimated_time_minutes, instructions) 
SELECT 
  ac.id,
  'Bring Lunch from Home',
  'Pack your own lunch to reduce packaging waste',
  30,
  1.5,
  2,
  20,
  'Prepare and pack your lunch in reusable containers. Take a photo of your homemade lunch.'
FROM public.action_categories ac WHERE ac.name = 'Food & Diet';

-- Office Practices Actions
INSERT INTO public.sustainability_actions (category_id, title, description, points_value, co2_impact, difficulty_level, estimated_time_minutes, instructions) 
SELECT 
  ac.id,
  'Print Double-Sided',
  'Use duplex printing to reduce paper consumption',
  10,
  0.1,
  1,
  2,
  'Set your printer to double-sided mode and print your documents. Take a screenshot of the printer settings.'
FROM public.action_categories ac WHERE ac.name = 'Office Practices';

INSERT INTO public.sustainability_actions (category_id, title, description, points_value, co2_impact, difficulty_level, estimated_time_minutes, instructions) 
SELECT 
  ac.id,
  'Use Digital Documents',
  'Go paperless by using digital alternatives',
  20,
  0.4,
  1,
  10,
  'Convert physical documents to digital format or use digital note-taking apps. Screenshot your digital workspace.'
FROM public.action_categories ac WHERE ac.name = 'Office Practices';

-- =============================================
-- BADGES
-- =============================================

INSERT INTO public.badges (name, description, criteria_type, criteria_value, badge_color, icon_url) VALUES
('First Steps', 'Complete your first sustainability action', 'actions', 1, '#10B981', NULL),
('Action Hero', 'Complete 10 sustainability actions', 'actions', 10, '#F59E0B', NULL),
('Eco Warrior', 'Complete 50 sustainability actions', 'actions', 50, '#8B5CF6', NULL),
('Sustainability Champion', 'Complete 100 sustainability actions', 'actions', 100, '#DC2626', NULL),

('Point Collector', 'Earn your first 100 points', 'points', 100, '#06B6D4', NULL),
('Rising Star', 'Earn 500 points', 'points', 500, '#84CC16', NULL),
('Green Leader', 'Earn 1000 points', 'points', 1000, '#6366F1', NULL),
('Sustainability Master', 'Earn 2500 points', 'points', 2500, '#EC4899', NULL),

('Carbon Saver', 'Save 5kg of CO2', 'co2_saved', 5, '#14B8A6', NULL),
('Climate Guardian', 'Save 25kg of CO2', 'co2_saved', 25, '#F97316', NULL),
('Planet Protector', 'Save 50kg of CO2', 'co2_saved', 50, '#7C3AED', NULL),
('Earth Champion', 'Save 100kg of CO2', 'co2_saved', 100, '#BE185D', NULL)
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- SYSTEM SETTINGS
-- =============================================

INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
('company_name', 'GreenLoop', 'string', 'Company name displayed in the application', true),
('points_per_level', '1000', 'number', 'Points required to advance to next level', true),
('max_team_size', '10', 'number', 'Maximum number of members per team', true),
('challenge_creation_enabled', 'true', 'boolean', 'Whether users can create their own challenges', true),
('verification_required_threshold', '100', 'number', 'Point value above which actions require verification', false),
('leaderboard_update_frequency', '3600', 'number', 'Leaderboard update frequency in seconds', false),
('email_notifications_enabled', 'true', 'boolean', 'Whether email notifications are enabled', false),
('maintenance_mode', 'false', 'boolean', 'Whether the application is in maintenance mode', false)
ON CONFLICT (setting_key) DO NOTHING;

-- =============================================
-- SAMPLE CHALLENGES
-- =============================================

INSERT INTO public.challenges (title, description, challenge_type, start_date, end_date, target_metric, target_value, reward_points, reward_description, created_by) 
SELECT 
  'Green Week Challenge',
  'Complete 5 sustainability actions in one week to promote environmental awareness',
  'individual',
  NOW(),
  NOW() + INTERVAL '7 days',
  'actions',
  5,
  200,
  'Exclusive Green Week badge and recognition',
  u.id
FROM public.users u 
WHERE u.email LIKE '%admin%' OR u.is_active = true
LIMIT 1;

INSERT INTO public.challenges (title, description, challenge_type, start_date, end_date, target_metric, target_value, reward_points, reward_description, created_by) 
SELECT 
  'Team Carbon Reduction',
  'Work together as a team to save 50kg of CO2 this month',
  'team',
  NOW(),
  NOW() + INTERVAL '30 days',
  'co2_saved',
  50,
  500,
  'Team lunch and sustainability recognition ceremony',
  u.id
FROM public.users u 
WHERE u.email LIKE '%admin%' OR u.is_active = true
LIMIT 1;
