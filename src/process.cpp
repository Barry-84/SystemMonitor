#include <unistd.h>
#include <cctype>
#include <sstream>
#include <string>
#include <vector>
#include <iostream>

#include <cmath>

#include "process.h"
#include "linux_parser.h"
#include "unistd.h"

using std::string;
using std::to_string;
using std::vector;

// TODO: Return this process's ID
int Process::Pid() { 
    return pid;
}

void Process::setPID(int pid_in) {
    pid = pid_in;
}

// TODO: Return this process's CPU utilization
float Process::CpuUtilization() { 
    // total time CPU has been busy with this process
    float process_totaltime = (float) LinuxParser::ActiveJiffies(Pid()) / (float) sysconf(_SC_CLK_TCK);  
    // start time of the process in seconds
    float process_startime = (float) LinuxParser::UpTime(Pid()); 
    // uptime of the system in seconds
    float system_uptime = (float) LinuxParser::UpTime(); 
    float process_uptime = system_uptime - process_startime;
    
    float cpu_load = (process_totaltime - process_totaltime_old) / (process_uptime - process_uptime_old);
    
    process_totaltime_old = process_totaltime;
    process_uptime_old = process_uptime;

    return cpu_load;
    
}

// TODO: Return the command that generated this process
string Process::Command() { return string(); }

// TODO: Return this process's memory utilization
string Process::Ram() {
    /* LinuxParser::Ram(int pid) returns this process's memory utilization in kB.
       So dividing by 2^10 = 1024 gives us MB.
    */
    long megaBytes = stol(LinuxParser::Ram(Pid())) / 1024;
    return to_string(megaBytes);
}

// TODO: Return the user (name) that generated this process
string Process::User() { 
    string user = LinuxParser::User(Pid());
    return user;
    //return string();
}

// TODO: Return the age of this process (in seconds)
long int Process::UpTime() { 
    // Note: "long and long int are identical" (from stackoverflow)
    // LinuxParser::UpTime(int pid) returns long and this method returns long int.
    return LinuxParser::UpTime(Pid());
}

// TODO: Overload the "less than" comparison operator for Process objects
// REMOVE: [[maybe_unused]] once you define the function
bool Process::operator<(Process const& a[[maybe_unused]]) const { return true; }