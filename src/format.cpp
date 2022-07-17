#include <string>

#include "format.h"
#include <iostream>
#include <math.h>
#include <sstream>
#include <iomanip>

using std::string;

// INPUT: Long int measuring seconds
// OUTPUT: HH:MM:SS
// REMOVE: [[maybe_unused]] once you define the function
string Format::ElapsedTime(long seconds) { 
    long full_hours = seconds / 3600;
    long full_minutes = (seconds % 3600) / 60;
    long full_seconds = seconds % 60;

    /* ensure hours, minutes and seconds are always displayed with
       two digits i.e. 0-9 is displayed with a leading zero.
    */
    std::stringstream ssfh;
    std::stringstream ssfm;
    std::stringstream ssfs;

    ssfh << std::setw(2) << std::setfill('0') << full_hours;
    ssfm << std::setw(2) << std::setfill('0') << full_minutes;
    ssfs << std::setw(2) << std::setfill('0') << full_seconds;

    return ssfh.str() + ":" + ssfm.str() + ":" + ssfs.str();

}