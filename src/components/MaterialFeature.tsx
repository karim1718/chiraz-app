import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const MaterialFeature = () => {
    const { t } = useTranslation();
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
                delayChildren: 0.3
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 1, ease: "easeOut" as const } }
    };

    return (
        <section className="bg-black text-[#e4e1d5] py-32 px-6 md:px-12 relative overflow-hidden">
            {/* Subtle Animated Noise Overlay for Luxury Film Feel */}
            <div className="absolute inset-0 opacity-[0.03] mix-blend-screen pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16 md:gap-24 relative z-10">
                <motion.div
                    className="w-full md:w-1/2 flex justify-center"
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                >
                    <div className="relative w-full max-w-[28rem] aspect-square rounded-full p-[1px] bg-gradient-to-br from-[#e4e1d5]/40 to-transparent">
                        <div className="absolute inset-0 rounded-full bg-black m-[1px] overflow-hidden">
                            {/* Infinite Breathing Animation on the Image */}
                            <motion.img
                                src="/material_close_up_1772247860736.png"
                                alt={t('material.alt')}
                                className="w-full h-full object-cover mix-blend-luminosity opacity-80"
                                animate={{
                                    scale: [1, 1.05, 1],
                                }}
                                transition={{
                                    duration: 8,
                                    ease: "linear",
                                    repeat: Infinity,
                                }}
                            />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    className="w-full md:w-1/2 space-y-8"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                >
                    <motion.h2 variants={itemVariants} className="text-4xl md:text-6xl font-serif leading-tight text-[#e4e1d5]">
                        {t('material.h2a')}<br />
                        <span className="text-[#e4e1d5]/70 italic">{t('material.h2b')}</span>
                    </motion.h2>

                    <motion.div variants={itemVariants} className="h-[1px] w-24 bg-[#e4e1d5]/50"></motion.div>

                    <motion.p variants={itemVariants} className="text-lg text-[#e4e1d5]/80 max-w-md leading-relaxed font-light">
                        {t('material.p')}
                    </motion.p>

                    <motion.ul variants={itemVariants} className="space-y-6 pt-6">
                        <li className="flex items-start gap-6 group">
                            <span className="text-[#e4e1d5] text-xl mt-1 opacity-50 transition-opacity group-hover:opacity-100">01</span>
                            <div>
                                <h4 className="font-serif text-2xl tracking-wide mb-2">{t('material.f1t')}</h4>
                                <p className="text-[#e4e1d5]/60 font-light leading-relaxed">{t('material.f1d')}</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-6 group">
                            <span className="text-[#e4e1d5] text-xl mt-1 opacity-50 transition-opacity group-hover:opacity-100">02</span>
                            <div>
                                <h4 className="font-serif text-2xl tracking-wide mb-2">{t('material.f2t')}</h4>
                                <p className="text-[#e4e1d5]/60 font-light leading-relaxed">{t('material.f2d')}</p>
                            </div>
                        </li>
                    </motion.ul>

                    <motion.div variants={itemVariants} className="pt-10">
                        <button className="relative overflow-hidden border border-[#e4e1d5]/30 text-[#e4e1d5] px-10 py-4 text-xs font-medium tracking-[0.2em] transition-all duration-500 hover:border-[#e4e1d5] group">
                            <span className="relative z-10 transition-colors duration-500 group-hover:text-black">{t('material.cta')}</span>
                            <div className="absolute inset-0 h-full w-full bg-[#e4e1d5] transform -translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:translate-y-0"></div>
                        </button>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
};

export default MaterialFeature;
