import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { dummyReports } from '../dummyData';

function ReportEditPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching the report to be edited
    const reportToEdit = dummyReports.find(r => r.report_id === parseInt(reportId));
    if (reportToEdit) {
      setReport(reportToEdit);
      setContent(reportToEdit.summary_content);
    }
    setLoading(false);
  }, [reportId]);

  const handleSave = () => {
    // In a real app, you would send this to the backend
    console.log(`Saving report ${reportId} with new content:`, content);
    alert('저장되었습니다! (백엔드 연동 필요)');
    navigate('/'); // Navigate back to dashboard after saving
  };

  if (loading) {
    return (
        <div className="flex">
            <Sidebar />
            <main className="flex-grow p-8">
                <p>리포트 로딩 중...</p>
            </main>
        </div>
    );
  }

  if (!report) {
    return (
        <div className="flex">
            <Sidebar />
            <main className="flex-grow p-8">
                <p>리포트를 찾을 수 없습니다.</p>
            </main>
        </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-grow p-8">
        <header className="mb-8">
            <h2 className="text-2xl font-bold">리포트 수정</h2>
            <p className="text-gray-500">{new Date(report.created_at).toLocaleString('ko-KR')} 리포트를 수정합니다.</p>
        </header>
        <div>
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-96 p-2 border rounded"
            />
            <div className="mt-4 flex gap-2">
                <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700">저장</button>
                <button onClick={() => navigate('/')} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">취소</button>
            </div>
        </div>
      </main>
    </div>
  );
}

export default ReportEditPage;
