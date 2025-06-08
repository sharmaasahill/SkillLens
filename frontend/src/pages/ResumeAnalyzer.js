import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

function ResumeAnalyzer() {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [uploadedFileName, setUploadedFileName] = useState('');
    const navigate = useNavigate();

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile) {
            if (selectedFile.type !== 'application/pdf') {
                setError('Please upload a PDF file');
                setFile(null);
                return;
            }
            if (selectedFile.size > 16 * 1024 * 1024) {
                setError('File size should be less than 16MB');
                setFile(null);
                return;
            }
            setFile(selectedFile);
            setError('');
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file first');
            return;
        }

        setUploading(true);
        setError('');
        setAnalysis(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('http://localhost:5000/upload-resume', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            setAnalysis(response.data);
            setUploadedFileName(response.data.filename || file.name);
        } catch (err) {
            console.error('Upload error:', err);
            setError(err.response?.data?.error || 'Failed to upload resume');
        } finally {
            setUploading(false);
            setFile(null);
            // Reset file input
            document.getElementById('resume-upload').value = '';
        }
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-green-600 bg-green-100';
        if (score >= 60) return 'text-yellow-600 bg-yellow-100';
        return 'text-red-600 bg-red-100';
    };

    const getScoreLabel = (score) => {
        if (score >= 80) return 'Excellent';
        if (score >= 60) return 'Good';
        if (score >= 40) return 'Fair';
        return 'Needs Improvement';
    };

    // Advanced Analysis Functions
    const calculateReadabilityScore = (text) => {
        if (!text) return 0;
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const avgWordsPerSentence = words.length / sentences.length;
        
        // Simple readability score (lower is better)
        if (avgWordsPerSentence <= 15) return 85;
        if (avgWordsPerSentence <= 20) return 70;
        if (avgWordsPerSentence <= 25) return 55;
        return 40;
    };



    const analyzeActionVerbs = (text) => {
        if (!text) return { strong: [], weak: [], score: 0 };
        
        const strongVerbs = [
            'achieved', 'developed', 'created', 'implemented', 'improved', 'increased',
            'generated', 'managed', 'led', 'supervised', 'coordinated', 'optimized',
            'streamlined', 'enhanced', 'delivered', 'executed', 'established', 'built',
            'designed', 'launched', 'spearheaded', 'transformed', 'accelerated'
        ];
        
        const weakVerbs = [
            'responsible for', 'worked on', 'helped with', 'participated in',
            'involved in', 'assisted with', 'contributed to'
        ];
        
        const foundStrong = [];
        const foundWeak = [];
        
        strongVerbs.forEach(verb => {
            if (text.toLowerCase().includes(verb)) {
                foundStrong.push(verb);
            }
        });
        
        weakVerbs.forEach(verb => {
            if (text.toLowerCase().includes(verb)) {
                foundWeak.push(verb);
            }
        });
        
        const score = Math.min(100, (foundStrong.length * 10) - (foundWeak.length * 5));
        
        return { strong: foundStrong, weak: foundWeak, score: Math.max(0, score) };
    };

    const getIndustrySpecificAdvice = (skills) => {
        const skillsList = Array.isArray(skills) ? skills : Object.values(skills || {}).flat();
        const skillsText = skillsList.join(' ').toLowerCase();
        
        // Software Development & Engineering
        if (skillsText.match(/\b(python|javascript|java|react|angular|vue|node|express|django|flask|spring|git|github|api|database|sql|nosql|mongodb|postgresql|docker|kubernetes|microservices|agile|scrum|frontend|backend|fullstack|full-stack|software|programming|coding|development)\b/)) {
            return {
                industry: 'Software Development & Engineering',
                confidence: 'High',
                advice: 'Showcase your technical projects, include GitHub profile, mention specific frameworks and programming languages, highlight problem-solving abilities.',
                keywords: ['software development', 'programming', 'coding', 'git', 'api development', 'database design', 'full-stack', 'agile methodology', 'code review', 'debugging', 'testing', 'deployment']
            };
        }
        
        // Data Science & Analytics
        else if (skillsText.match(/\b(data|analytics|machine learning|ml|ai|artificial intelligence|python|r|sql|tableau|power bi|pandas|numpy|tensorflow|pytorch|scikit|statistics|modeling|visualization|big data|hadoop|spark|etl)\b/)) {
            return {
                industry: 'Data Science & Analytics',
                confidence: 'High',
                advice: 'Emphasize quantifiable business impact of your analyses, highlight data visualization skills, mention statistical methods and machine learning techniques.',
                keywords: ['data analysis', 'machine learning', 'statistical modeling', 'data visualization', 'predictive analytics', 'business intelligence', 'data mining', 'big data', 'statistical analysis', 'data-driven insights']
            };
        }
        
        // Cloud & DevOps
        else if (skillsText.match(/\b(aws|azure|gcp|google cloud|cloud|devops|docker|kubernetes|terraform|jenkins|ci\/cd|ansible|monitoring|infrastructure|serverless|microservices)\b/)) {
            return {
                industry: 'Cloud & DevOps Engineering',
                confidence: 'High',
                advice: 'Highlight cloud certifications, automation achievements, infrastructure optimization, and cost savings from cloud migrations.',
                keywords: ['cloud architecture', 'devops', 'automation', 'infrastructure as code', 'ci/cd', 'monitoring', 'scalability', 'cloud migration', 'containerization', 'orchestration']
            };
        }
        
        // Cybersecurity
        else if (skillsText.match(/\b(security|cybersecurity|penetration testing|ethical hacking|firewall|encryption|vulnerability|compliance|risk assessment|incident response|siem|soc)\b/)) {
            return {
                industry: 'Cybersecurity',
                confidence: 'High',
                advice: 'Emphasize security certifications, incident response experience, compliance knowledge, and risk mitigation achievements.',
                keywords: ['information security', 'threat assessment', 'vulnerability management', 'incident response', 'security compliance', 'risk management', 'penetration testing', 'security audit']
            };
        }
        
        // Digital Marketing
        else if (skillsText.match(/\b(marketing|seo|sem|social media|digital marketing|content marketing|email marketing|ppc|google ads|facebook ads|analytics|conversion|campaigns|brand)\b/)) {
            return {
                industry: 'Digital Marketing',
                confidence: 'High',
                advice: 'Include specific campaign results, ROI improvements, conversion rates, and digital platform expertise.',
                keywords: ['digital marketing', 'campaign management', 'roi optimization', 'conversion rate', 'brand awareness', 'lead generation', 'content strategy', 'social media marketing', 'email marketing']
            };
        }
        
        // Product Management
        else if (skillsText.match(/\b(product management|product manager|roadmap|user experience|ux|ui|product strategy|stakeholder|agile|scrum|user research|product development)\b/)) {
            return {
                industry: 'Product Management',
                confidence: 'High',
                advice: 'Highlight product launches, user adoption metrics, cross-functional collaboration, and strategic product decisions.',
                keywords: ['product strategy', 'product roadmap', 'user experience', 'stakeholder management', 'product development', 'market analysis', 'user research', 'product metrics']
            };
        }
        
        // Finance & Accounting
        else if (skillsText.match(/\b(finance|accounting|financial analysis|budgeting|forecasting|excel|financial modeling|investment|risk management|compliance|audit|cpa|cfa)\b/)) {
            return {
                industry: 'Finance & Accounting',
                confidence: 'High',
                advice: 'Emphasize financial certifications, cost savings achieved, budget management experience, and analytical skills.',
                keywords: ['financial analysis', 'budget management', 'financial modeling', 'risk assessment', 'investment analysis', 'cost reduction', 'financial reporting', 'compliance']
            };
        }
        
        // Sales & Business Development
        else if (skillsText.match(/\b(sales|business development|account management|relationship building|crm|salesforce|lead generation|negotiation|revenue|quota|targets)\b/)) {
            return {
                industry: 'Sales & Business Development',
                confidence: 'High',
                advice: 'Highlight revenue achievements, quota performance, client relationship building, and business growth contributions.',
                keywords: ['sales performance', 'revenue generation', 'client relationship', 'business development', 'account management', 'lead generation', 'negotiation', 'quota achievement']
            };
        }
        
        // Healthcare & Medical
        else if (skillsText.match(/\b(healthcare|medical|nursing|clinical|patient care|healthcare administration|medical records|hipaa|electronic health records|ehr)\b/)) {
            return {
                industry: 'Healthcare & Medical',
                confidence: 'Medium',
                advice: 'Emphasize patient care experience, medical certifications, compliance knowledge, and healthcare technology proficiency.',
                keywords: ['patient care', 'clinical experience', 'medical knowledge', 'healthcare compliance', 'patient safety', 'medical documentation', 'healthcare technology']
            };
        }
        
        // Education & Training
        else if (skillsText.match(/\b(education|teaching|training|curriculum|learning|instruction|classroom management|educational technology|assessment)\b/)) {
            return {
                industry: 'Education & Training',
                confidence: 'Medium',
                advice: 'Highlight student outcomes, curriculum development, educational technology integration, and professional development.',
                keywords: ['curriculum development', 'instructional design', 'student assessment', 'educational technology', 'classroom management', 'learning outcomes', 'professional development']
            };
        }
        
        // Default fallback
        else {
            return {
                industry: 'General Professional',
                confidence: 'Low',
                advice: 'Focus on leadership experience, cross-functional collaboration, problem-solving abilities, and quantifiable achievements.',
                keywords: ['leadership', 'collaboration', 'problem-solving', 'communication', 'project management', 'teamwork', 'analytical thinking', 'strategic planning']
            };
        }
    };

    return (
        <motion.div
            className="min-h-screen p-6 sm:p-10 bg-gradient-to-br from-green-50 via-blue-50 to-purple-100 dark:bg-gray-900 text-gray-800 dark:text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            {/* 🔙 Back Button */}
            <div className="flex justify-end mb-4">
                <button
                    onClick={() => navigate('/')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow font-medium"
                >
                    🔙 Back to Home
                </button>
            </div>

            <div className="max-w-6xl mx-auto bg-white/60 dark:bg-gray-800/40 backdrop-blur-lg p-8 rounded-2xl shadow-xl">
                <h1 className="text-3xl font-bold mb-6 text-center">📄 Resume Analyzer</h1>

                {/* Upload Section */}
                <div className="mb-8">
                    <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                                </svg>
                                <p className="mb-2 text-sm text-gray-500">
                                    <span className="font-semibold">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-xs text-gray-500">PDF only (MAX. 16MB)</p>
                            </div>
                    <input
                                id="resume-upload"
                        type="file"
                                className="hidden"
                        accept=".pdf"
                        onChange={handleFileChange}
                                disabled={uploading}
                            />
                        </label>
                    </div>

                    {error && (
                        <div className="mt-2 text-red-500 text-sm">{error}</div>
                    )}

                    <div className="mt-4 flex justify-center">
                    <button
                        onClick={handleUpload}
                            disabled={!file || uploading}
                            className={`px-6 py-3 rounded-md text-white font-medium ${
                                !file || uploading
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {uploading ? 'Analyzing Resume...' : 'Upload and Analyze'}
                    </button>
                    </div>
                </div>

                {/* Advanced Analysis Results */}
                {analysis && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-8"
                    >
                        {/* Uploaded File Info */}
                        {uploadedFileName && (
                            <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 shadow-lg border-l-4 border-blue-500">
                                <div className="flex items-center gap-3">
                                    <div className="text-2xl">📄</div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white">Analyzing Resume:</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">{uploadedFileName}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* ATS Compatibility Score */}
                        {analysis.ats_analysis && (
                            <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-6 shadow-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                                        🎯 ATS Compatibility Score
                                    </h2>
                                    <div className={`px-4 py-2 rounded-full font-bold text-lg ${getScoreColor(analysis.ats_analysis.score)}`}>
                                        {Math.round(analysis.ats_analysis.score)}/100 - {getScoreLabel(analysis.ats_analysis.score)}
                                    </div>
                                </div>
                                
                                {/* Score Breakdown */}
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <h3 className="text-lg font-medium mb-3">✅ Strengths</h3>
                                        <ul className="space-y-2">
                                            {analysis.ats_analysis.found_sections?.length > 0 && (
                                                <li className="flex items-center text-green-600">
                                                    <span className="mr-2">•</span>
                                                    Found {analysis.ats_analysis.found_sections.length} required sections: {analysis.ats_analysis.found_sections.join(', ')}
                                                </li>
                                            )}
                                            {analysis.ats_analysis.keyword_matches > 10 && (
                                                <li className="flex items-center text-green-600">
                                                    <span className="mr-2">•</span>
                                                    Contains {analysis.ats_analysis.keyword_matches} industry keywords
                                                </li>
                                            )}
                                            {analysis.ats_analysis.problematic_elements?.length === 0 && (
                                                <li className="flex items-center text-green-600">
                                                    <span className="mr-2">•</span>
                                                    No problematic formatting elements detected
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                    
                                    <div>
                                        <h3 className="text-lg font-medium mb-3">⚠️ Areas for Improvement</h3>
                                        {analysis.ats_analysis.issues?.length > 0 ? (
                                            <ul className="space-y-2">
                                                {analysis.ats_analysis.issues.map((issue, index) => (
                                                    <li key={index} className="flex items-start text-red-600">
                                                        <span className="mr-2 mt-1">•</span>
                                                        <span className="text-sm">{issue}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-green-600">No major issues detected!</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Skills Analysis */}
                        {analysis.skills && (
                            <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-6 shadow-lg">
                                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                                    🛠️ Skills Analysis
                                </h2>
                                
                                {/* Handle both old format (array) and new format (categorized object) */}
                                {Array.isArray(analysis.skills) ? (
                                    // Old format - simple array
                                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                        <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-3">
                                            Detected Skills
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {analysis.skills.map((skill, index) => (
                                                <span
                                                    key={index}
                                                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm rounded-full border border-blue-200 dark:border-blue-700"
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                                💡 <strong>Tip:</strong> Total of {analysis.skills.length} skills detected. 
                                                Consider highlighting your most relevant skills for the positions you're targeting.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    // New format - categorized object
                                    <>
                                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {Object.entries(analysis.skills).map(([category, skillList]) => (
                                                <div key={category} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                                    <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-3">
                                                        {category}
                                                    </h3>
                        <div className="flex flex-wrap gap-2">
                                                        {skillList.map((skill, index) => (
                                <span
                                                                key={index}
                                                                className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm rounded-full border border-blue-200 dark:border-blue-700"
                                >
                                    {skill}
                                </span>
                            ))}
                        </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                                💡 <strong>Tip:</strong> Total of {Object.values(analysis.skills).flat().length} skills detected. 
                                                Consider highlighting your most relevant skills for the positions you're targeting.
                                            </p>
                                        </div>
                                    </>
                                )}
                    </div>
                )}

                        {/* Resume Quality Analysis */}
                        <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-6 shadow-lg">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                                📊 Resume Quality Analysis
                            </h2>
                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <div className="text-3xl font-bold text-blue-600">
                                        {analysis.text ? Math.round(analysis.text.split(/\s+/).length) : 0}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-300">Total Words</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {analysis.text && analysis.text.split(/\s+/).length < 200 ? 'Consider adding more detail' : 
                                         analysis.text && analysis.text.split(/\s+/).length > 800 ? 'Consider being more concise' : 
                                         'Good length'}
                                    </div>
                                </div>
                                
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <div className="text-3xl font-bold text-green-600">
                                        {analysis.ats_analysis?.found_sections?.length || 0}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-300">Sections Detected</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {(analysis.ats_analysis?.found_sections?.length || 0) >= 4 ? 'Well structured' : 'Add more sections'}
                                    </div>
                                </div>
                                
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <div className="text-3xl font-bold text-purple-600">
                                        {analysis.ats_analysis?.keyword_matches || 0}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-300">Industry Keywords</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {(analysis.ats_analysis?.keyword_matches || 0) >= 15 ? 'Excellent keyword usage' : 
                                         (analysis.ats_analysis?.keyword_matches || 0) >= 5 ? 'Good keyword usage' : 'Add more keywords'}
                                    </div>
                                </div>
                                
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <div className="text-3xl font-bold text-orange-600">
                                        {calculateReadabilityScore(analysis.text)}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-300">Readability Score</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {calculateReadabilityScore(analysis.text) >= 80 ? 'Very readable' : 
                                         calculateReadabilityScore(analysis.text) >= 60 ? 'Good readability' : 'Improve clarity'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Advanced Content Analysis */}
                        <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-6 shadow-lg">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                                🔍 Advanced Content Analysis
                            </h2>
                            {/* Action Verbs Analysis */}
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                                    ⚡ Action Verbs Analysis
                                    <span className={`px-2 py-1 rounded text-xs ${getScoreColor(analyzeActionVerbs(analysis.text).score)}`}>
                                        {analyzeActionVerbs(analysis.text).score}/100
                                    </span>
                                </h3>
                                {(() => {
                                    const verbAnalysis = analyzeActionVerbs(analysis.text);
                                    return (
                                        <div className="space-y-3">
                                            {verbAnalysis.strong.length > 0 && (
                                                <div>
                                                    <p className="text-sm font-medium text-green-600 mb-2">✅ Strong Action Verbs Found:</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {verbAnalysis.strong.slice(0, 8).map((verb, index) => (
                                                            <span key={index} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                                                {verb}
                                                            </span>
                                                        ))}
                                                        {verbAnalysis.strong.length > 8 && (
                                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                                                +{verbAnalysis.strong.length - 8} more
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {verbAnalysis.weak.length > 0 && (
                                                <div>
                                                    <p className="text-sm font-medium text-red-600 mb-2">⚠️ Weak Phrases to Replace:</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {verbAnalysis.weak.slice(0, 5).map((phrase, index) => (
                                                            <span key={index} className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                                                                {phrase}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {verbAnalysis.strong.length === 0 && verbAnalysis.weak.length === 0 && (
                                                <p className="text-sm text-gray-600">Add more action verbs to strengthen your resume!</p>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Industry-Specific Analysis */}
                        {(() => {
                            const industryAnalysis = getIndustrySpecificAdvice(analysis.skills);
                            return (
                                <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-6 shadow-lg">
                                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                                        🎯 Industry-Specific Analysis
                                    </h2>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                            <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                                                🏢 Detected Industry: 
                                                <span className="text-blue-600">{industryAnalysis.industry}</span>
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    industryAnalysis.confidence === 'High' ? 'bg-green-100 text-green-800' :
                                                    industryAnalysis.confidence === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {industryAnalysis.confidence} Confidence
                                                </span>
                                            </h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                                                {industryAnalysis.advice}
                                            </p>
                                        </div>
                                        
                                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                            <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-3">
                                                🔑 Recommended Keywords
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {industryAnalysis.keywords.map((keyword, index) => (
                                                    <span key={index} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                                                        {keyword}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2">
                                                Consider including these industry-relevant terms naturally in your resume
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Action Items Checklist */}
                        <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-6 shadow-lg">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                                ✅ Action Items Checklist
                            </h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                {(() => {
                                    const wordCount = analysis.text ? analysis.text.split(/\s+/).length : 0;
                                    const skillCount = Array.isArray(analysis.skills) ? analysis.skills.length : Object.values(analysis.skills || {}).flat().length;
                                    const atsScore = analysis.ats_analysis?.score || 0;
                                    const verbAnalysis = analyzeActionVerbs(analysis.text);
                                    
                                    const actionItems = [
                                        {
                                            task: "Add contact information",
                                            completed: !analysis.ats_analysis?.issues?.some(issue => issue.toLowerCase().includes('contact')),
                                            priority: "High"
                                        },
                                        {
                                            task: "Use strong action verbs",
                                            completed: verbAnalysis.strong.length >= 5,
                                            priority: "Medium"
                                        },
                                        {
                                            task: "Optimize for ATS (70+ score)",
                                            completed: atsScore >= 70,
                                            priority: "High"
                                        },
                                        {
                                            task: "Add more skills (10+ recommended)",
                                            completed: skillCount >= 10,
                                            priority: "Medium"
                                        },
                                        {
                                            task: "Ensure proper length (200-600 words)",
                                            completed: wordCount >= 200 && wordCount <= 600,
                                            priority: "Medium"
                                        },
                                        {
                                            task: "Include standard sections",
                                            completed: (analysis.ats_analysis?.found_sections?.length || 0) >= 4,
                                            priority: "High"
                                        },
                                        {
                                            task: "Remove weak phrases",
                                            completed: verbAnalysis.weak.length === 0,
                                            priority: "Low"
                                        }
                                    ];

                                    const completedItems = actionItems.filter(item => item.completed);
                                    const pendingItems = actionItems.filter(item => !item.completed);

                                    return (
                                        <>
                                            <div>
                                                <h3 className="text-lg font-medium text-green-800 dark:text-green-200 mb-3">
                                                    ✅ Completed ({completedItems.length}/{actionItems.length})
                                                </h3>
                                                <div className="space-y-2">
                                                    {completedItems.map((item, index) => (
                                                        <div key={index} className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/30 rounded">
                                                            <span className="text-green-600">✓</span>
                                                            <span className="text-sm text-green-800 dark:text-green-200">{item.task}</span>
                                                        </div>
                                                    ))}
                                                    {completedItems.length === 0 && (
                                                        <p className="text-sm text-gray-500">No items completed yet</p>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-3">
                                                    🎯 To Do ({pendingItems.length} remaining)
                                                </h3>
                                                <div className="space-y-2">
                                                    {pendingItems.map((item, index) => (
                                                        <div key={index} className={`flex items-center gap-2 p-2 rounded ${
                                                            item.priority === 'High' ? 'bg-red-50 dark:bg-red-900/30' :
                                                            item.priority === 'Medium' ? 'bg-yellow-50 dark:bg-yellow-900/30' :
                                                            'bg-blue-50 dark:bg-blue-900/30'
                                                        }`}>
                                                            <span className={`px-2 py-1 rounded text-xs ${
                                                                item.priority === 'High' ? 'bg-red-100 text-red-800' :
                                                                item.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-blue-100 text-blue-800'
                                                            }`}>
                                                                {item.priority}
                                                            </span>
                                                            <span className="text-sm text-gray-800 dark:text-gray-200">{item.task}</span>
                                                        </div>
                                                    ))}
                                                    {pendingItems.length === 0 && (
                                                        <div className="text-center p-4">
                                                            <span className="text-2xl">🎉</span>
                                                            <p className="text-sm text-green-600 mt-2">All action items completed!</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Recommendations */}
                        <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-6 shadow-lg">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                                💡 Smart Recommendations
                            </h2>
                            <div className="space-y-4">
                                {(() => {
                                    const skillCount = Array.isArray(analysis.skills) 
                                        ? analysis.skills.length 
                                        : Object.values(analysis.skills || {}).flat().length;
                                    const wordCount = analysis.text ? analysis.text.split(/\s+/).length : 0;
                                    const atsScore = analysis.ats_analysis?.score || 0;
                                    const foundSections = analysis.ats_analysis?.found_sections?.length || 0;
                                    const keywordMatches = analysis.ats_analysis?.keyword_matches || 0;
                                    const hasIssues = analysis.ats_analysis?.issues?.length > 0;
                                    
                                    const recommendations = [];
                                    
                                    // ATS Score Analysis
                                    if (atsScore < 40) {
                                        recommendations.push({
                                            type: 'critical',
                                            title: 'Critical ATS Issues',
                                            message: 'Your resume needs significant optimization for ATS systems. Focus on the issues listed above immediately.',
                                            icon: '🚨'
                                        });
                                    } else if (atsScore < 70) {
                                        recommendations.push({
                                            type: 'warning',
                                            title: 'ATS Optimization Needed',
                                            message: 'Your resume could benefit from better ATS optimization. Address the specific issues mentioned above.',
                                            icon: '⚠️'
                                        });
                                    }
                                    
                                    // Skills Analysis
                                    if (skillCount < 5) {
                                        recommendations.push({
                                            type: 'warning',
                                            title: 'Limited Skills Detected',
                                            message: `Only ${skillCount} skills were detected. Consider adding more relevant technical and soft skills to strengthen your profile.`,
                                            icon: '🛠️'
                                        });
                                    } else if (skillCount > 30) {
                                        recommendations.push({
                                            type: 'info',
                                            title: 'Skill Prioritization',
                                            message: `You have ${skillCount} skills listed. Consider prioritizing the most relevant skills for your target positions.`,
                                            icon: '🎯'
                                        });
                                    }
                                    
                                    // Content Length Analysis
                                    if (wordCount < 150) {
                                        recommendations.push({
                                            type: 'critical',
                                            title: 'Content Too Brief',
                                            message: `Your resume has only ${wordCount} words. Add more details about your experience, achievements, and qualifications.`,
                                            icon: '📝'
                                        });
                                    } else if (wordCount > 1000) {
                                        recommendations.push({
                                            type: 'info',
                                            title: 'Consider Conciseness',
                                            message: `Your resume has ${wordCount} words. Consider making it more concise while keeping key information.`,
                                            icon: '✂️'
                                        });
                                    }
                                    
                                    // Section Structure Analysis
                                    if (foundSections < 3) {
                                        recommendations.push({
                                            type: 'warning',
                                            title: 'Missing Key Sections',
                                            message: `Only ${foundSections} standard sections detected. Consider adding sections like Experience, Education, Skills, and Summary.`,
                                            icon: '📋'
                                        });
                                    }
                                    
                                    // Keyword Analysis
                                    if (keywordMatches < 5) {
                                        recommendations.push({
                                            type: 'warning',
                                            title: 'Low Industry Keywords',
                                            message: `Only ${keywordMatches} industry keywords found. Research job descriptions and include relevant keywords naturally.`,
                                            icon: '🔍'
                                        });
                                    } else if (keywordMatches > 20) {
                                        recommendations.push({
                                            type: 'success',
                                            title: 'Great Keyword Usage',
                                            message: `Excellent! ${keywordMatches} industry keywords detected. This should help with ATS systems.`,
                                            icon: '✅'
                                        });
                                    }
                                    
                                    // Contact Information Check
                                    const hasContactIssues = analysis.ats_analysis?.issues?.some(issue => 
                                        issue.toLowerCase().includes('contact')
                                    );
                                    if (hasContactIssues) {
                                        recommendations.push({
                                            type: 'critical',
                                            title: 'Missing Contact Information',
                                            message: 'Ensure your resume includes email, phone number, and LinkedIn profile for better accessibility.',
                                            icon: '📞'
                                        });
                                    }
                                    
                                    // Format Issues
                                    const hasFormatIssues = analysis.ats_analysis?.problematic_elements?.length > 0;
                                    if (hasFormatIssues) {
                                        recommendations.push({
                                            type: 'warning',
                                            title: 'Formatting Improvements',
                                            message: `Detected: ${analysis.ats_analysis.problematic_elements.join(', ')}. Use simple formatting for better ATS compatibility.`,
                                            icon: '🎨'
                                        });
                                    }
                                    

                                    
                                    // Success Messages
                                    if (atsScore >= 80 && skillCount >= 10 && wordCount >= 200 && foundSections >= 4) {
                                        recommendations.push({
                                            type: 'success',
                                            title: 'Excellent Resume! 🎉',
                                            message: 'Your resume is well-optimized with good structure, relevant skills, and ATS compatibility. You\'re ready to apply!',
                                            icon: '🌟'
                                        });
                                    } else if (atsScore >= 70 && skillCount >= 5) {
                                        recommendations.push({
                                            type: 'success',
                                            title: 'Good Foundation',
                                            message: 'Your resume has a solid foundation. Address the minor issues above to make it even better.',
                                            icon: '👍'
                                        });
                                    }
                                    
                                    // Specific Improvement Suggestions
                                    if (recommendations.length === 0 || recommendations.every(r => r.type === 'success')) {
                                        recommendations.push({
                                            type: 'info',
                                            title: 'Additional Tips',
                                            message: 'Consider using stronger action verbs, adding quantified achievements, and tailoring your resume for specific job applications.',
                                            icon: '💡'
                                        });
                                    }
                                    
                                    return recommendations;
                                })().map((rec, index) => (
                                    <div key={index} className={`p-4 rounded-lg border-l-4 ${
                                        rec.type === 'critical' ? 'bg-red-50 dark:bg-red-900/30 border-red-400' :
                                        rec.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-400' :
                                        rec.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 border-green-400' :
                                        'bg-blue-50 dark:bg-blue-900/30 border-blue-400'
                                    }`}>
                                        <h3 className={`font-medium flex items-center gap-2 ${
                                            rec.type === 'critical' ? 'text-red-800 dark:text-red-200' :
                                            rec.type === 'warning' ? 'text-yellow-800 dark:text-yellow-200' :
                                            rec.type === 'success' ? 'text-green-800 dark:text-green-200' :
                                            'text-blue-800 dark:text-blue-200'
                                        }`}>
                                            <span className="text-lg">{rec.icon}</span>
                                            {rec.title}
                                        </h3>
                                        <p className={`text-sm mt-1 ${
                                            rec.type === 'critical' ? 'text-red-700 dark:text-red-300' :
                                            rec.type === 'warning' ? 'text-yellow-700 dark:text-yellow-300' :
                                            rec.type === 'success' ? 'text-green-700 dark:text-green-300' :
                                            'text-blue-700 dark:text-blue-300'
                                        }`}>
                                            {rec.message}
                                        </p>
                                    </div>
                                ))}
                            </div>
                    </div>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}

export default ResumeAnalyzer;
