import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useThemeContext } from '../context/ThemeContext';

interface AuthPromptProps {
  title?: string;
  description?: string;
  icon?: string;
}

export default function AuthPrompt({ 
  title = "Welcome to Speeddo!", 
  description = "Login to access your profile and orders.", 
  icon = "🛍️" 
}: AuthPromptProps) {
  const navigate = useNavigate();
  const { currentTheme } = useThemeContext();

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          type: "spring",
          stiffness: 260,
          damping: 20,
          delay: 0.1 
        }}
        className="w-48 h-48 bg-purple-50 rounded-full flex items-center justify-center mb-8 relative shadow-inner"
      >
        <span className="text-8xl select-none">{icon}</span>
      </motion.div>

      <motion.h2 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-black text-neutral-900 mb-3 tracking-tight"
      >
        {title}
      </motion.h2>
      
      <motion.p 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-neutral-500 text-sm max-w-xs leading-relaxed mb-10 font-medium"
      >
        {description}
      </motion.p>

      <motion.button
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate('/login')}
        className="px-10 py-4 text-white font-black rounded-2xl shadow-2xl transition-all uppercase tracking-widest text-sm hover:shadow-purple-200/50"
        style={{ 
          background: `linear-gradient(135deg, ${currentTheme.primary[2]}, ${currentTheme.primary[1]})`,
          boxShadow: `0 20px 40px -10px ${currentTheme.primary[2]}4D`
        }}
      >
        Login
      </motion.button>

    </div>
  );
}
