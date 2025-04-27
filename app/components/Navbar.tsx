import Link from 'next/link';
import Image from 'next/image';

const Navbar = () => {
  return (
    <nav className="bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center">
              <div className="w-[100px] relative">
                <Image
                  src="/pic/logo.png"
                  alt="KodNest"
                  width={100}
                  height={28}
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
            <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
              <Link 
                href="/" 
                className="border-b-2 border-[#FDB813] px-1 pt-1 text-sm font-medium text-black"
              >
                Home
              </Link>
              <Link 
                href="/courses" 
                className="px-1 pt-1 text-sm font-medium text-gray-400 hover:text-gray-500"
              >
                Courses
              </Link>
              <Link 
                href="/practice" 
                className="px-1 pt-1 text-sm font-medium text-gray-400 hover:text-gray-500"
              >
                Practice
              </Link>
              <Link 
                href="/contest" 
                className="px-1 pt-1 text-sm font-medium text-gray-400 hover:text-gray-500"
              >
                Contest
              </Link>
              <a 
                href="/f2f-interview"
                target="_blank"
                rel="noopener noreferrer" 
                className="px-1 pt-1 text-sm font-medium text-gray-400 hover:text-gray-500"
              >
                F2F Interview
              </a>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <Link 
              href="/help-and-earn" 
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              Help and Earn
            </Link>
            <Link 
              href="/mentor-connect" 
              className="text-gray-500 hover:text-gray-600 text-sm font-medium flex items-center"
            >
              <span>Mentor Connect</span>
              <span className="ml-2 text-gray-400 text-lg">?</span>
            </Link>
            <div className="flex items-center">
              <button className="rounded-full hover:bg-gray-50 transition-colors">
                <span className="sr-only">View profile</span>
                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 