'use client';

import Image from 'next/image';
import Navbar from './components/Navbar';
import { useEffect, useState } from 'react';

export default function Home() {
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const liveClasses = [
    {
      id: 1,
      title: 'Java - 2025',
      mentor: 'Punith Kumar',
      progress: '97.03%',
      classTime: '09:00 AM - 10:15 AM',
      status: 'Not Started',
      icon: 'J'
    },
    {
      id: 2,
      title: 'SQL - 2025',
      mentor: 'Punith Kumar',
      progress: '89.17%',
      classTime: '10:15 AM - 11:00 AM',
      status: 'Not Started',
      icon: 'S'
    },
    {
      id: 3,
      title: 'TCS Preparation 2025',
      mentor: 'Ayush B',
      progress: '97.3%',
      classTime: '02:30 PM - 04:00 PM',
      status: 'Not Started',
      icon: 'T'
    }
  ];

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      
      {/* BroKod Hero Section */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                BroKod: Your Learning Ally at KodNest
              </h1>
              <p className="text-lg text-gray-600 mb-4">
                Unlock your potential with BroKod – your mentor, friend, coach, guide, and companion.
              </p>
              <p className="text-gray-500 mb-8">
                Available 24/7 to support your journey, from learning to career success
              </p>
              <button className="bg-primary hover:bg-primary/90 text-black px-8 py-3 rounded-md font-medium text-sm">
                Chat with BroKod
              </button>
            </div>
            <div className="hidden lg:block">
              <div className="w-[280px] h-[280px]">
                <Image 
                  src="/pic/brokod.png"
                  alt="BroKod Character"
                  width={280}
                  height={280}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Classes Section */}
      <div className="bg-gray-50/80 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900">Live Classes</h2>
              <span className="text-gray-400 text-sm">ⓘ</span>
            </div>
            <div className="flex space-x-2">
              <button className="p-2 rounded-full border border-gray-300 hover:bg-gray-50">
                <span className="sr-only">Previous</span>
                ←
              </button>
              <button className="p-2 rounded-full border border-gray-300 hover:bg-gray-50">
                <span className="sr-only">Next</span>
                →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveClasses.map((classItem) => (
              <div key={classItem.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center font-medium">
                    {classItem.icon}
                  </div>
                  <div className="ml-4">
                    <h3 className="font-medium text-gray-900">{classItem.title}</h3>
                    <p className="text-sm text-gray-500">Mentor: {classItem.mentor}</p>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Progress</span>
                    <span className="text-gray-900">{classItem.progress}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-progress-yellow rounded-full transition-all duration-300"
                      style={{ width: classItem.progress }}
                    ></div>
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Class Time: {classItem.classTime}</span>
                  <span className="text-status-yellow font-medium">{classItem.status}</span>
                </div>
                <div className="mt-4 flex justify-between border-t pt-4">
                  <button className="text-gray-600 text-sm flex items-center hover:text-gray-900">
                    Help Desk
                  </button>
                  {classItem.title === 'TCS Preparation 2025' ? (
                    <a
                      href={`${origin}/f2f-interview`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-sm flex items-center font-medium hover:text-primary/80"
                    >
                      F2F Interview →
                    </a>
                  ) : (
                    <button className="text-primary text-sm flex items-center font-medium hover:text-primary/80">
                      Join Class →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
} 