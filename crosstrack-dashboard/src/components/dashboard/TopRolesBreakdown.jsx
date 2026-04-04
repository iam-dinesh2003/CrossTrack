import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Briefcase } from 'lucide-react';

const ROLE_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#06B6D4', '#EC4899'];

// Mirror backend normalization map for consistent display
const ROLE_NORM_MAP = {
  'sde': 'Software Dev Engineer',
  'sde 1': 'Software Dev Engineer',
  'sde-1': 'Software Dev Engineer',
  'sde i': 'Software Dev Engineer',
  'sde1': 'Software Dev Engineer',
  'software development engineer': 'Software Dev Engineer',
  'software development engineer i': 'Software Dev Engineer',
  'software development engineer 1': 'Software Dev Engineer',
  'swe': 'Software Engineer',
  'swe 1': 'Software Engineer',
  'swe i': 'Software Engineer',
  'software engineer i': 'Software Engineer',
  'software engineer 1': 'Software Engineer',
  'software engineer': 'Software Engineer',
  'software engineer ii': 'Software Engineer II',
  'software engineer 2': 'Software Engineer II',
  'sr software engineer': 'Sr. Software Engineer',
  'senior software engineer': 'Sr. Software Engineer',
  'jr software engineer': 'Jr. Software Engineer',
  'junior software engineer': 'Jr. Software Engineer',
  'java developer': 'Java Developer',
  'java engineer': 'Java Developer',
  'java software engineer': 'Java Developer',
  'cloud engineer': 'Cloud Engineer',
  'cloud infrastructure engineer': 'Cloud Engineer',
  'cloud devops engineer': 'Cloud Engineer',
  'devops engineer': 'DevOps Engineer',
  'dev ops engineer': 'DevOps Engineer',
  'jr. dev ops engineer': 'DevOps Engineer',
  'jr dev ops engineer': 'DevOps Engineer',
  'jr dev ops': 'DevOps Engineer',
  'junior devops engineer': 'DevOps Engineer',
  'full stack developer': 'Full Stack Developer',
  'full-stack developer': 'Full Stack Developer',
  'fullstack developer': 'Full Stack Developer',
  'full stack engineer': 'Full Stack Developer',
  'full-stack engineer': 'Full Stack Developer',
  'front end developer': 'Frontend Developer',
  'front-end developer': 'Frontend Developer',
  'frontend developer': 'Frontend Developer',
  'frontend engineer': 'Frontend Developer',
  'back end developer': 'Backend Developer',
  'back-end developer': 'Backend Developer',
  'backend developer': 'Backend Developer',
  'backend engineer': 'Backend Developer',
  'qa engineer': 'QA Engineer',
  'quality assurance engineer': 'QA Engineer',
  'test engineer': 'QA Engineer',
  'data engineer': 'Data Engineer',
  'data analyst': 'Data Analyst',
  'data scientist': 'Data Scientist',
  'ml engineer': 'ML Engineer',
  'machine learning engineer': 'ML Engineer',
  'web developer': 'Web Developer',
  'graphic designer': 'Graphic Designer',
  'product manager': 'Product Manager',
  'project manager': 'Project Manager',
};

function normalizeRole(role) {
  if (!role) return null;
  const key = role.trim().toLowerCase().replace(/\s+/g, ' ');
  if (key === 'unknown role') return null;
  // Reject garbled roles (long email subject fragments)
  if (key.length > 40) return null;
  return ROLE_NORM_MAP[key] || titleCase(key);
}

function titleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="tooltip-premium text-white px-4 py-3 rounded-xl shadow-2xl text-xs">
        <p className="font-bold">{payload[0].payload.role}</p>
        <p className="text-indigo-300 mt-1">{payload[0].value} application{payload[0].value !== 1 ? 's' : ''}</p>
      </div>
    );
  }
  return null;
};

export default function TopRolesBreakdown({ applications = [] }) {
  // Count roles (normalized, skipping Unknown Role)
  const roleCounts = {};
  let unknownCount = 0;

  applications.forEach(app => {
    const normalized = normalizeRole(app.role);
    if (!normalized) {
      unknownCount++;
      return;
    }
    // Truncate extremely long names
    const display = normalized.length > 28 ? normalized.substring(0, 25) + '...' : normalized;
    roleCounts[display] = (roleCounts[display] || 0) + 1;
  });

  // Sort by count, take top 8
  const data = Object.entries(roleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([role, count], i) => ({
      role,
      count,
      fill: ROLE_COLORS[i % ROLE_COLORS.length],
    }));

  const uniqueCount = Object.keys(roleCounts).length;

  return (
    <div className="card-premium p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-gray-900 text-[15px] tracking-tight">Top Roles Applied</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">{uniqueCount} unique roles tracked</p>
        </div>
        <div className="p-2 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg">
          <Briefcase size={16} className="text-indigo-500" />
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <div className="empty-state-circle w-14 h-14 rounded-2xl flex items-center justify-center mb-3">
            <Briefcase size={24} className="text-indigo-300" />
          </div>
          <p className="text-sm font-medium">No role data yet</p>
          <p className="text-xs mt-1 text-gray-400">Start applying to see your top roles</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
            <BarChart data={data} layout="vertical" barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="role"
                tick={{ fontSize: 11, fill: '#64748B', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                width={160}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {unknownCount > 0 && (
            <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              {unknownCount} with unidentified roles
            </p>
          )}
        </>
      )}
    </div>
  );
}
