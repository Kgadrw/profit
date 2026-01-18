import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { LoginModal } from "@/components/LoginModal";
import { User } from "lucide-react";

const Home = () => {
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginModalTab, setLoginModalTab] = useState<"login" | "create">("create");

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <div className="relative min-h-[calc(100vh-4rem)] flex items-center px-6 lg:px-12 xl:px-20 py-16 lg:py-24">
        <div className="w-full max-w-7xl mx-auto flex flex-col gap-12">
          {/* Text Content */}
          <div className="text-left max-w-2xl">
            <h1 className="text-2xl lg:text-3xl font-serif font-normal text-gray-900 mb-8 leading-tight">
              Run your business smarter with Trippo
            </h1>
            <Button
              className="bg-gray-400 text-white hover:bg-gray-600 px-5 py-2.5 text-sm font-medium rounded-full"
              onClick={() => {
                setLoginModalTab("create");
                setLoginModalOpen(true);
              }}
            >
              Get Started
            </Button>
          </div>
          
          {/* Hero Images */}
          <div className="w-full flex gap-0">
            {/* Card 1 */}
            <div className="w-1/5 relative group h-32 md:h-80">
              <img 
                src="/card1.jpg" 
                alt="Woman managing inventory with Trippo" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20"></div>
            </div>

            {/* Card 2 */}
            <div className="w-1/5 relative group h-32 md:h-80">
              <img 
                src="/card2.png" 
                alt="Man struggling with business" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20"></div>
            </div>

            {/* Card 3 */}
            <div className="w-1/5 relative group h-32 md:h-80">
              <img 
                src="/card3.jpg" 
                alt="Woman using Trippo system" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20"></div>
            </div>

            {/* Card 4 */}
            <div className="w-1/5 relative group h-32 md:h-80">
              <img 
                src="/card4.jpg" 
                alt="Happy team managing stock" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20"></div>
            </div>

            {/* Card 5 */}
            <div className="w-1/5 relative group h-32 md:h-80">
              <img 
                src="/card5.jpg" 
                alt="Successful business owners" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20"></div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="w-full">
            <h2 className="text-2xl lg:text-3xl font-serif font-normal text-gray-900 mb-6">Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Product Management Card */}
              <div className="border border-gray-200 bg-gray-100 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    Products
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Add, edit, and manage your product inventory with ease. Track stock levels and control your inventory efficiently.
                </p>
              </div>

              {/* Sales Tracking Card */}
              <div className="border border-gray-200 bg-gray-100 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    Sales
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Record sales transactions and track revenue and profits in real-time. Monitor your business performance effortlessly.
                </p>
              </div>

              {/* Reports & Analytics Card */}
              <div className="border border-gray-200 bg-gray-100 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                    Reports
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  View detailed reports and sales trends. Generate comprehensive analytics to make data-driven business decisions.
                </p>
              </div>

              {/* Offline Support Card */}
              <div className="border border-gray-200 bg-gray-100 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                    Offline
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Work offline with automatic sync when connection is restored. Your data is always safe and accessible.
                </p>
              </div>
            </div>
          </div>

          {/* Testimonials */}
          <div className="w-full relative bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/testmonial.webp)' }}>
            <div className="absolute inset-0 bg-white/70"></div>
            <div className="relative z-10 py-12 px-6">
              <div className="text-center mb-6">
                <h2 className="text-base lg:text-lg font-serif font-normal text-white inline-block px-4 py-1.5 bg-gray-600 rounded-full">
                  What our users say
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Testimonial 1 */}
              <div className="bg-gray-50 p-6">
                <p className="text-sm text-gray-700 leading-relaxed mb-4">
                  "Trippo transformed how we manage inventory. Adoption went from struggling to track products to over 90% of our team using it daily. It just spread like wildfire in our business."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex-shrink-0 flex items-center justify-center">
                    <User size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Sarah Johnson</p>
                    <p className="text-xs text-gray-500">Store Manager, Retail Co.</p>
                  </div>
                </div>
              </div>

              {/* Testimonial 2 */}
              <div className="bg-gray-50 p-6">
                <p className="text-sm text-gray-700 leading-relaxed mb-4">
                  "The most useful inventory management tool I've used. It's fast, handles stock levels properly, sensible interface, works offline... everything is well put together for small businesses."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex-shrink-0 flex items-center justify-center">
                    <User size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Michael Chen</p>
                    <p className="text-xs text-gray-500">Business Owner, Chen Trading</p>
                  </div>
                </div>
              </div>

              {/* Testimonial 3 */}
              <div className="bg-gray-50 p-6">
                <p className="text-sm text-gray-700 leading-relaxed mb-4">
                  "The best inventory management has flexibility: you control how much detail to track. In Trippo, you can do basic product management, detailed analytics, or full comprehensive reporting - all in one tool."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex-shrink-0 flex items-center justify-center">
                    <User size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">David Williams</p>
                    <p className="text-xs text-gray-500">Operations Director, Williams Supply</p>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="w-full">
            <h2 className="text-2xl lg:text-3xl font-serif font-normal text-gray-900 mb-6 text-center">Pricing</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Basic Plan */}
              <div className="border border-gray-200 bg-gray-100 p-4 flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    Basic
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-3">
                  <span className="font-semibold text-lg">$0</span>
                  <span className="text-xs text-gray-500 ml-1">/month</span>
                </p>
                <ul className="text-sm text-gray-700 space-y-2 leading-relaxed mb-4 flex-grow">
                  <li>• Product inventory management</li>
                  <li>• Sales tracking and recording</li>
                  <li>• Basic reports and analytics</li>
                  <li>• Offline support with sync</li>
                  <li>• Up to 100 products</li>
                </ul>
                <Button
                  className="bg-gray-500 text-white hover:bg-gray-600 rounded-full px-4 py-2 text-sm w-full"
                  onClick={() => {
                    setLoginModalTab("create");
                    setLoginModalOpen(true);
                  }}
                >
                  Get Started
                </Button>
              </div>

              {/* Pro Plan */}
              <div className="border border-gray-200 bg-gray-100 p-4 flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    Pro
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-3">
                  <span className="font-semibold text-lg">$19</span>
                  <span className="text-xs text-gray-500 ml-1">/month</span>
                </p>
                <ul className="text-sm text-gray-700 space-y-2 leading-relaxed mb-4 flex-grow">
                  <li>• Everything in Basic</li>
                  <li>• Unlimited products</li>
                  <li>• Advanced analytics & insights</li>
                  <li>• Export reports (PDF, Excel)</li>
                  <li>• Priority support</li>
                </ul>
                <Button
                  className="bg-gray-500 text-white hover:bg-gray-600 rounded-full px-4 py-2 text-sm w-full"
                  onClick={() => {
                    setLoginModalTab("create");
                    setLoginModalOpen(true);
                  }}
                >
                  Subscribe
                </Button>
              </div>

              {/* Enterprise Plan */}
              <div className="border border-gray-200 bg-gray-100 p-4 flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                    Enterprise
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-3">
                  <span className="font-semibold text-lg">$49</span>
                  <span className="text-xs text-gray-500 ml-1">/month</span>
                </p>
                <ul className="text-sm text-gray-700 space-y-2 leading-relaxed mb-4 flex-grow">
                  <li>• Everything in Pro</li>
                  <li>• Multi-user access</li>
                  <li>• Advanced security features</li>
                  <li>• API access & integrations</li>
                  <li>• Dedicated account manager</li>
                </ul>
                <Button
                  className="bg-gray-500 text-white hover:bg-gray-600 rounded-full px-4 py-2 text-sm w-full"
                  onClick={() => {
                    setLoginModalTab("create");
                    setLoginModalOpen(true);
                  }}
                >
                  Subscribe
                </Button>
              </div>

              {/* Custom Plan */}
              <div className="border border-gray-200 bg-gray-100 p-4 flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                    Custom
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-3">
                  <span className="font-semibold text-lg">$99</span>
                  <span className="text-xs text-gray-500 ml-1">/month</span>
                </p>
                <ul className="text-sm text-gray-700 space-y-2 leading-relaxed mb-4 flex-grow">
                  <li>• Everything in Enterprise</li>
                  <li>• Custom feature development</li>
                  <li>• White-label solution</li>
                  <li>• On-premise deployment</li>
                  <li>• 24/7 priority support</li>
                </ul>
                <Button
                  className="bg-gray-500 text-white hover:bg-gray-600 rounded-full px-4 py-2 text-sm w-full"
                  onClick={() => {
                    setLoginModalTab("create");
                    setLoginModalOpen(true);
                  }}
                >
                  Subscribe
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Login Modal */}
      <LoginModal
        open={loginModalOpen}
        onOpenChange={setLoginModalOpen}
        defaultTab={loginModalTab}
      />

      {/* Footer */}
      <footer className="bg-stone-50 border-t border-gray-200">
        <div className="container mx-auto px-6 lg:px-12 xl:px-20 py-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
            {/* Product Column */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-4">Product</h3>
              <ul className="space-y-3">
                <li><a href="#features" className="text-sm text-gray-900 hover:text-gray-600">Features</a></li>
                <li><a href="#pricing" className="text-sm text-gray-900 hover:text-gray-600">Pricing</a></li>
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">Enterprise</a></li>
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">Reports</a></li>
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">Analytics</a></li>
              </ul>
            </div>

            {/* Resources Column */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-4">Resources</h3>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">Documentation</a></li>
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">Support</a></li>
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">Blog</a></li>
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">Guides</a></li>
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">API</a></li>
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-4">Company</h3>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">About</a></li>
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">Careers</a></li>
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">Contact</a></li>
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">Press</a></li>
              </ul>
            </div>

            {/* Legal Column */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-4">Legal</h3>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">Terms of Service</a></li>
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">Privacy Policy</a></li>
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">Data Use</a></li>
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">Security</a></li>
              </ul>
            </div>

            {/* Connect Column */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-4">Connect</h3>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">X (Twitter)</a></li>
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">LinkedIn</a></li>
                <li><a href="#" className="text-sm text-gray-900 hover:text-gray-600">YouTube</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="pt-8 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-600">© 2025 Trippo. All rights reserved.</p>
            
            <div className="flex items-center gap-4">
              {/* Theme Switcher */}
              <div className="flex items-center border border-gray-200 rounded-lg p-1 bg-white">
                <button className="p-1.5 hover:bg-gray-100 rounded" title="System">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </button>
                <button className="p-1.5 bg-gray-100 hover:bg-gray-100 rounded" title="Light">
                  <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </button>
                <button className="p-1.5 hover:bg-gray-100 rounded" title="Dark">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
