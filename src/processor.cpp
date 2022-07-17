#include <string>
#include <vector>

#include "processor.h"
#include "linux_parser.h"

using std::string;
using std::vector;

float Processor::Utilization() {
    /* reporting the current utilization of the processor, 
       rather than the long-term average utilization since
       boot: Delta (Active Time Units) / Delta (Total Time Units). */
    long activeJiffies = LinuxParser::ActiveJiffies();
    long jiffies = LinuxParser::Jiffies();
    float utilization = ((float) activeJiffies - prevActiveJiffies) / ((float) jiffies - prevJiffies);
    // or is a single explicit cast after the division sufficient?
    // float utilization = (float) (activeJiffies - prevActiveJiffies) / (jiffies - prevJiffies);
    prevActiveJiffies = activeJiffies;
    prevJiffies = jiffies;
    return utilization;
}