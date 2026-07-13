'use client'

import Link from 'next/link';
import { useState } from 'react';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 3000);
    }
  };

  const productLinks = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Stock Fundermentals', href: '/stockpage' },
    { name: 'Sectors', href: '/sector_page' },
    { name: 'Portfolio ', href: '/portfolio' },
    { name: 'Watchlist', href: '/watchlist' },
  ];

  const companyLinks = [
    { name: 'About Us', href: '/about' },
    { name: 'Guide', href: '#' },
    { name: 'FAQ', href: '#' },
  ];

  const resourceLinks = [
    { name: 'Company Profiles', href: '/stockdetails' },
    { name: 'Financial Reports', href: '/report_data/income' },
    { name: 'Ratio Analysis', href: '/ratios/income' },
    { name: 'Calculations', href: '/calculations/income' },
    { name: 'Valuations', href: '/valuations' },
 
  ];

  const legalLinks = [
    { name: 'Privacy Policy', href: '#' },
    { name: 'Terms of Service', href: '#' },
    { name: 'Cookie Policy', href: '#' },
    { name: 'Disclaimer', href: '#' },
  ];

  return (
    <footer className="relative bg-gradient-to-b from-[#0D1325] via-[#0b1020] to-[#000000] text-white mt-auto overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#B28D41] rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#306B99] rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      {/* Newsletter Section */}
      <div className="relative border-b border-[#306B99]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bowlby text-white mb-3">
                Stay <span className="text-[#E9D37E]">Ahead</span> of the Market
              </h2>
              <p className="text-gray-400 font-encode text-sm sm:text-base max-w-xl">
                Get exclusive market insights, stock alerts, and financial analysis delivered to your inbox weekly.
              </p>
            </div>
            <div className="lg:flex lg:justify-end">
              <form onSubmit={handleSubscribe} className="w-full max-w-md">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="w-full bg-[#182847]/50 border border-[#306B99]/30 text-white placeholder-gray-500 rounded-lg px-4 py-3 sm:py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#B28D41]/50 focus:border-[#B28D41] transition-all"
                      required
                    />
                    {subscribed && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-3 sm:py-4 text-sm font-encode font-semibold bg-gradient-to-r from-[#B28D41] to-[#E9D37E] text-[#0D1325] rounded-lg hover:shadow-lg hover:shadow-[#B28D41]/30 transition-all duration-300 hover:scale-105 whitespace-nowrap"
                  >
                    Subscribe Now
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-3 font-encode">
                  By subscribing, you agree to our Privacy Policy and consent to receive updates.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
            
            {/* Company Info */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center space-x-3 mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#B28D41] rounded-lg blur opacity-50" />
                  <div className="relative bg-gradient-to-br from-[#E9D37E] to-[#B28D41] p-2 rounded-lg">
                    <svg className="w-8 h-8 text-[#0D1325]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                      <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/>
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bowlby text-white">BUYZONLABS</h3>
                  <p className="text-xs text-[#B28D41] font-encode">Stock Analytics</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm font-encode leading-relaxed mb-6">
                Advanced AI-powered stock market prediction and comprehensive financial analysis platform for smart investors.
              </p>
              
              {/* Social Links */}
              <div className="flex items-center space-x-3">
                {[
                  { icon: 'M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z', name: 'Twitter' },
                  { icon: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z', name: 'Facebook' },
                  { icon: 'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z M4 2a2 2 0 100 4 2 2 0 000-4z', name: 'LinkedIn' },
                  { icon: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22', name: 'GitHub' }
                ].map((social, idx) => (
                  <a
                    key={idx}
                    href="#"
                    className="w-10 h-10 rounded-lg bg-[#182847]/50 border border-[#306B99]/30 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#306B99]/30 hover:border-[#B28D41] transition-all duration-300 group"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={social.icon} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Products */}
            <div>
              <h4 className="text-base font-bowlby text-white mb-4 sm:mb-6">Products</h4>
              <ul className="space-y-2 sm:space-y-3">
                {productLinks.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm font-encode text-gray-400 hover:text-[#E9D37E] transition-colors duration-200 flex items-center group"
                    >
                      <span className="w-0 group-hover:w-2 h-px bg-[#B28D41] transition-all duration-200 mr-0 group-hover:mr-2" />
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            

            {/* Resources */}
            <div>
              <h4 className="text-base font-bowlby text-white mb-4 sm:mb-6">Data</h4>
              <ul className="space-y-2 sm:space-y-3">
                {resourceLinks.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm font-encode text-gray-400 hover:text-[#E9D37E] transition-colors duration-200 flex items-center group"
                    >
                      <span className="w-0 group-hover:w-2 h-px bg-[#B28D41] transition-all duration-200 mr-0 group-hover:mr-2" />
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-base font-bowlby text-white mb-4 sm:mb-6">Company</h4>
              <ul className="space-y-2 sm:space-y-3">
                {companyLinks.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm font-encode text-gray-400 hover:text-[#E9D37E] transition-colors duration-200 flex items-center group"
                    >
                      <span className="w-0 group-hover:w-2 h-px bg-[#B28D41] transition-all duration-200 mr-0 group-hover:mr-2" />
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>           
            </div>

            {/* Contact & Stats */}
            <div>
              <h4 className="text-base font-bowlby text-white mb-4 sm:mb-6">Get in Touch</h4>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-[#B28D41] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="text-xs text-gray-500 font-encode">Email</p>
                    <a href="mailto:info@bisson.com" className="text-sm text-gray-300 hover:text-[#E9D37E] transition-colors font-encode">
                      info@buyzonlabs.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-[#B28D41] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <div>
                    <p className="text-xs text-gray-500 font-encode">Phone</p>
                    <a href="tel:+1234567890" className="text-sm text-gray-300 hover:text-[#E9D37E] transition-colors font-encode">
                      +94 234 567-890
                    </a>
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="pt-4 space-y-2">
                  <div className="flex items-center space-x-2 text-xs text-gray-400 font-encode">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Secure & Encrypted</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-400 font-encode">
                    {/*
                    <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    <span>50K+ Active Users</span>*/}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="relative border-t border-[#306B99]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-center md:text-left">
              <p className="text-sm text-gray-400 font-encode">
                &copy; {new Date().getFullYear()} <span className="text-[#B28D41]">BUYZONLABS</span>. All rights reserved.
              </p>
              <p className="text-xs text-gray-500 font-encode mt-1">
                Stock analysis platform powered by BUYZONLABS.
              </p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-xs font-encode">
              {legalLinks.map((link, idx) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-gray-400 hover:text-[#E9D37E] transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Bottom Line */}
      <div className="h-1 bg-gradient-to-r from-transparent via-[#B28D41] to-transparent" />
    </footer>
  );
}
