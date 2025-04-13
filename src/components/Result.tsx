//src/components/Result.tsx

import { useState, useEffect } from 'react';
import { getContract } from '@/utils/blockchainUtils';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts';

interface Candidate {
  name: string;
  voteCount: bigint;
}

const generateColors = (count: number) => {
  const baseColors = [
    '#60a5fa', '#34d399', '#a78bfa', '#f87171', '#fbbf24', 
    '#4ade80', '#f472b6', '#2dd4bf', '#fb923c', '#a855f7'
  ];
  
  return count <= baseColors.length 
    ? baseColors.slice(0, count) 
    : [...Array(count)].map((_, i) => 
        `hsl(${(i * 137.508) % 360}, 70%, 60%)`
      );
};

export default function Result() {
  const [results, setResults] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const contract = await getContract();
        const candidateResults = await contract.getVoteCounts();
        setResults(candidateResults);
      } catch (err) {
        setError('Failed to fetch results');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, []);

  if (loading) {
    return (
      <Card className="w-full bg-gray-800">
        <CardContent className="flex justify-center items-center min-h-[200px]">
          <div className="text-lg text-gray-200">Loading results...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="w-full">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const totalVotes = results.reduce((sum, candidate) => 
    sum + candidate.voteCount, 
    BigInt(0)
  );

  const maxVotes = results.reduce((max, candidate) => 
    candidate.voteCount > max ? candidate.voteCount : max, 
    BigInt(0)
  );

  const winners = results.filter(candidate => 
    candidate.voteCount === maxVotes
  );

  const chartData = results.map(candidate => ({
    name: candidate.name,
    value: Number(candidate.voteCount)
  }));

  const COLORS = generateColors(results.length);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const votes = payload[0].value;
      const percentage = totalVotes > BigInt(0) 
        ? ((votes / Number(totalVotes)) * 100).toFixed(1)
        : '0.0';
      
      return (
        <div className="bg-gray-800 p-2 border border-gray-700 rounded shadow text-gray-200">
          <p className="font-medium">{payload[0].name}</p>
          <p>{`${votes} votes (${percentage}%)`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className=" bg-gray-800 border-gray-700">
    <CardHeader>
      <CardTitle className="text-2xl text-center text-gray-200">
        Election Results
      </CardTitle>
    </CardHeader>
    <CardContent>
      {/* Winners Section */}
      <Card className="mb-6 bg-blue-900/30 border-blue-500/30">
        <CardHeader>
          <CardTitle className="text-xl text-gray-200">
            {winners.length > 1 ? 'Draw Between:' : 'Winner:'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {winners.map(winner => (
              <div key={winner.name} className="flex justify-between items-center text-gray-200">
                <span className="font-medium">{winner.name}</span>
                <span className="text-blue-400 font-bold">
                  {winner.voteCount.toString()} votes
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

          {/* Pie Chart */}
          {totalVotes > BigInt(0) && (
            <div className="h-[300px] md:h-[400px] w-full mx-auto">
              <ResponsiveContainer width="100%" height="100%"
                onResize={(width, height) => setChartDimensions({ width: width || 0, height: height || 0 })}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={Math.min(chartDimensions.width, chartDimensions.height) * 0.35}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {chartData.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* All Results */}
          <Card className="w-full mt-6 bg-blue-900/30 border-blue-500/30">
            <CardHeader>
              <CardTitle className="text-lg text-gray-200">All Results:</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.map((candidate, index) => (
                  <div key={candidate.name} className="flex justify-between items-center text-gray-200">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index] }}
                      />
                      <span>{candidate.name}</span>
                    </div>
                    <span className="font-medium">
                      {candidate.voteCount.toString()} votes
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
  
  );
}