import { SettingsPanel } from "@/components/SettingsPanel";
import { motion } from "framer-motion";

export default function Settings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <SettingsPanel />
      </motion.div>
    </div>
  );
}
