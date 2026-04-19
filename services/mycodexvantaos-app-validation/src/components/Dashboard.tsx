import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';

// URN: urn:mycodexvantaos:app:ui:validation-mock-data
const mockValidations = [
  {
    id: 'val-001',
    originalFileName: 'service_agreement_v1.pdf',
    status: 'COMPLETED',
    createdAt: '2024-01-15T10:30:00Z',
    analysis: {
      overallRiskLevel: 'MEDIUM',
      confidence: 87,
      createdAt: '2024-01-15T10:32:00Z',
    },
  },
  {
    id: 'val-002',
    originalFileName: 'nda_partner_corp.docx',
    status: 'COMPLETED',
    createdAt: '2024-01-14T14:20:00Z',
    analysis: {
      overallRiskLevel: 'LOW',
      confidence: 92,
      createdAt: '2024-01-14T14:21:00Z',
    },
  },
  {
    id: 'val-003',
    originalFileName: 'investment_seed.pdf',
    status: 'PROCESSING',
    createdAt: '2024-01-16T09:15:00Z',
  },
];

const mockUser = {
  name: 'System User',
  monthlyQuota: 20,
  usedQuota: 3,
  subscriptionPlan: 'STANDARD',
};

export default function ValidationDashboard() {
  const [validations, setValidations] = useState(mockValidations);
  const [user, setUser] = useState(mockUser);
  const [isUploading, setIsUploading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const completedValidations = validations.filter(v => v.status === 'COMPLETED').length;
  const remainingQuota = user.monthlyQuota - user.usedQuota;
  const estimatedTimeSaved = completedValidations * 2.17; 

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalError(null);
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Simulate File Size Check
    if (file.size > 50 * 1024 * 1024) {
       setGlobalError(`File size for "${file.name}" exceeds the 50MB limit.`);
       return;
    }

    if (remainingQuota <= 0) {
       setGlobalError("Monthly quota exceeded. Please upgrade your subscription plan to validate more documents.");
       return;
    }

    setIsUploading(true);
    
    // 模擬 Provider 呼叫
    setTimeout(() => {
      const newValidation = {
        id: `val-${Date.now()}`,
        originalFileName: file.name,
        status: 'PROCESSING' as const,
        createdAt: new Date().toISOString(),
      };
      
      setValidations(prev => [newValidation, ...prev]);
      setUser(prev => ({ ...prev, usedQuota: prev.usedQuota + 1 }));
      setIsUploading(false);

      setTimeout(() => {
        // Simulate specific processing failures (e.g. if filename contains 'corrupt' or 'error')
        const isCorrupt = file.name.toLowerCase().includes('corrupt') || file.name.toLowerCase().includes('error');
        
        if (isCorrupt) {
           setValidations(prev => prev.map(v => 
              v.id === newValidation.id 
                ? { ...v, status: 'FAILED' as const, errorMessage: 'Processing Failed [ER-001]: The document appears to be corrupted, unreadable, or password protected.' }
                : v
           ));
           return;
        }

        setValidations(prev => prev.map(v => 
          v.id === newValidation.id 
            ? {
                ...v,
                status: 'COMPLETED' as const,
                analysis: {
                  overallRiskLevel: 'MEDIUM' as const,
                  confidence: 85,
                  createdAt: new Date().toISOString(),
                },
              }
            : v
        ));
      }, 3000);
    }, 1000);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'text-green-600 bg-green-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'HIGH': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getRiskText = (level: string) => {
    switch (level) {
      case 'LOW': return 'LOW RISK';
      case 'MEDIUM': return 'MEDIUM RISK';
      case 'HIGH': return 'HIGH RISK';
      default: return 'UNKNOWN';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <FileText className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">MyCodexVantaOS Validation</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user.name}</span>
              <button className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">
                Settings
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {globalError && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-md flex items-start shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 font-medium">{globalError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Analyzed Built</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{user.usedQuota}</p>
              </div>
              <FileText className="w-12 h-12 text-blue-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Quota Remaining</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{remainingQuota}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-600 opacity-20" />
            </div>
            <div className="mt-2">
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(user.usedQuota / user.monthlyQuota) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{completedValidations}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Hours Saved</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {estimatedTimeSaved.toFixed(1)}
                  <span className="text-lg text-gray-600 ml-1">h</span>
                </p>
              </div>
              <TrendingUp className="w-12 h-12 text-purple-600 opacity-20" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <div className="text-center">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".pdf,.doc,.docx"
              onChange={handleFileUpload}
              disabled={isUploading || remainingQuota <= 0}
            />
            <label
              htmlFor="file-upload"
              className={`inline-flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                isUploading || remainingQuota <= 0
                  ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                  : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'
              }`}
            >
              {isUploading ? (
                <>
                  <Clock className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                  <p className="text-lg font-medium text-gray-900">Processing...</p>
                </>
              ) : remainingQuota <= 0 ? (
                <>
                  <AlertCircle className="w-12 h-12 text-red-600 mb-4" />
                  <p className="text-lg font-medium text-gray-900">Quota Exceeded</p>
                  <p className="text-sm text-gray-600 mt-2">Please upgrade your plan</p>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-blue-600 mb-4" />
                  <p className="text-lg font-medium text-gray-900">Upload to Validate</p>
                  <p className="text-sm text-gray-600 mt-2">
                    PDF, Word up to 50 MB
                  </p>
                  <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                    Browse Files
                  </button>
                </>
              )}
            </label>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Validations</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {validations.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                No validations found
              </div>
            ) : (
              validations.map(val => (
                <div key={val.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <FileText className="w-10 h-10 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {val.originalFileName}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Uploaded {formatDate(val.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {val.status === 'PROCESSING' ? (
                        <div className="flex items-center space-x-2">
                          <Clock className="w-5 h-5 text-blue-600 animate-spin" />
                          <span className="text-sm text-blue-600">Validating...</span>
                        </div>
                      ) : val.status === 'COMPLETED' && val.analysis ? (
                        <>
                          <div className="flex items-center space-x-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskColor(val.analysis.overallRiskLevel)}`}>
                              {getRiskText(val.analysis.overallRiskLevel)}
                            </span>
                            <span className="text-xs text-gray-500">
                              Confidence {val.analysis.confidence}%
                            </span>
                          </div>
                          <button className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                            View Report
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-end space-y-1">
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <span className="text-sm text-red-600 font-medium">Failed</span>
                          </div>
                          {('errorMessage' in val) && val.errorMessage && (
                            <span className="text-xs text-red-500 max-w-xs text-right whitespace-normal">
                              {val.errorMessage as string}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
