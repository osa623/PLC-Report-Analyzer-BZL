'use client'

//imports for Uis
import Waves from '../../Ui/Waves';
import GridMotion from '../../Ui/GridMotion';

const items = [
  'Item 1',
  <div key='jsx-item-1'>Custom JSX Content</div>,
  'https://images.unsplash.com/photo-1723403804231-f4e9b515fe9d?q=80&w=3870&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'Item 2',
  <div key='jsx-item-2'>Custom JSX Content</div>,
  'Item 4',
  <div key='jsx-item-3'>Custom JSX Content</div>,
  'https://images.unsplash.com/photo-1723403804231-f4e9b515fe9d?q=80&w=3870&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'Item 5',
  <div key='jsx-item-4'>Custom JSX Content</div>,
  'Item 7',
  <div key='jsx-item-5'>Custom JSX Content</div>,
  'https://images.unsplash.com/photo-1723403804231-f4e9b515fe9d?q=80&w=3870&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'Item 8',
  <div key='jsx-item-6'>Custom JSX Content</div>,
  'Item 10',
  <div key='jsx-item-7'>Custom JSX Content</div>,
  'https://images.unsplash.com/photo-1723403804231-f4e9b515fe9d?q=80&w=3870&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'Item 11',
  <div key='jsx-item-8'>Custom JSX Content</div>,
  'Item 13',
  <div key='jsx-item-9'>Custom JSX Content</div>,
  'https://images.unsplash.com/photo-1723403804231-f4e9b515fe9d?q=80&w=3870&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'Item 14',
];


export default function FeedbackSection() {
  return (

    /* Main Section */
    <div className="relative h-screen w-full bg-transparent">

            {/* Lower div Section for 2 sections */}

          <div className="absolute flex-col flex z-40 h-auto w-full overflow-hidden">


                <div className="relative z-50 flex inset-0 h-[100vh]">
                     {/* Wave Patterns */}
                     
                      <div className="absolute z-20 w-full h-full">
                        <Waves
                            lineColor="#fff"
                            backgroundColor="#000"
                            waveSpeedX={0.07}
                            waveSpeedY={0.01}
                            waveAmpX={40}
                            waveAmpY={20}
                            friction={0.9}
                            tension={0.01}
                            maxCursorMove={120}
                            xGap={12}
                            yGap={36}
                          />
                      </div>
                       <div className="absolute z-20 w-full h-full">
                        <Waves
                            lineColor="#fff"
                            backgroundColor="transparent"
                            waveSpeedX={0.02}
                            waveSpeedY={0.01}
                            waveAmpX={40}
                            waveAmpY={20}
                            friction={0.9}
                            tension={0.01}
                            maxCursorMove={120}
                            xGap={12}
                            yGap={36}
                          />
                      </div>

                     {/* black background*/}
                      <div className="absolute bg-gradient-to-t from-black via-black to-transparent z-30 w-full h-full"/>
                      <div className="absolute bg-gradient-to-b from-black via-black/15 to-transparent z-30 w-full h-full"/>
                      <div className="absolute bg-transparent flex  z-50 w-[100%] h-full">
                          <div className="flex bg-black  z-50 w-[20%] h-full"/>
                           <div className="flex  bg-gradient-to-r from-black via-black/50 to-transparent  z-50 w-[80%] h-full"/>
                      </div>  
 
                        {/* Sliding Menu for the Comprehensive Card */}
                       <div className="absolute z-40 w-[80%] h-full bg-transparent top-0 right-0">
                            <GridMotion items={items} />
                      </div>

                      {/* texting area for the Feature section */}
                 <div className="absolute z-50 flex-col top-1/2 -translate-y-1/2 left-0 h-full flex items-start justify-center bg-transparent w-[50%] pl-12">
                              <div className="relative flex h-auto  w-auto">
                                <h2 className="absolute text-nowrap flex font-bowlby top-0 md:text-[3rem] md:ml-12 text-white">
                                    WHAT_OUR<div className="relative flex bg-black w-full"/>
                                </h2>
                                <h2 className="absolute flex font-bowlby md:text-[3.5rem] top-12 text-nowrap   md:ml-12 text-white">
                                    USERS___<div className="text-amber-300"></div>
                                </h2>
                                 <h2 className="absolute font-bowlby md:text-[7rem] top-20   md:ml-12 text-amber-300">
                                    SAY||
                                </h2>
                                                                
       
                              </div>
                     </div>


                    <div className="absolute z-50 flex-col top-40 left-0 border-black h-full flex items-center bg-transparent w-[50%] h-f">
                             

                   </div> 


                </div>

          </div>



    </div>
  );
}
