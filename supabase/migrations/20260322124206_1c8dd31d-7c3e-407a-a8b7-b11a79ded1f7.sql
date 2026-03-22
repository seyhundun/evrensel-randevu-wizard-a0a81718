
INSERT INTO bot_settings (key, value, label) 
VALUES ('manual_browser_requested', 'false', 'Manuel tarayıcı açma isteği')
ON CONFLICT (key) DO NOTHING;
