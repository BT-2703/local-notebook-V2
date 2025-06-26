-- Insertar configuraciones LLM por defecto
INSERT INTO llm_configs (name, provider, model, is_default) VALUES
('Ollama Llama 3.1', 'ollama', 'llama3.1', true),
('OpenAI GPT-4', 'openai', 'gpt-4', false),
('Anthropic Claude', 'anthropic', 'claude-3-sonnet-20240229', false),
('Google Gemini', 'gemini', 'gemini-pro', false)
ON CONFLICT DO NOTHING;

-- Crear usuario administrador por defecto (contraseña: admin123)
INSERT INTO users (email, password_hash, full_name, is_admin) VALUES
('admin@horuslm.local', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrador', true)
ON CONFLICT (email) DO NOTHING;