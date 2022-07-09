#include <unistd.h>
#include <cctype>
#include <sstream>
#include <string>
#include <vector>
#include <iostream>

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
    float totaltime = (float) LinuxParser::ActiveJiffies(Pid());
    float startime = (float) LinuxParser::UpTime(Pid()); // uptime of the process, measured in "clock ticks"
    float uptime = (float) LinuxParser::UpTime(); // uptime of the system
    float hertz = (float) sysconf(_SC_CLK_TCK);
    float seconds = uptime - (startime / hertz);
    return (totaltime / hertz) / seconds;
}

// TODO: Return the command that generated this process
string Process::Command() { return string(); }

// TODO: Return this process's memory utilization
string Process::Ram() { return string(); }

// TODO: Return the user (name) that generated this process
string Process::User() { 
    string user = LinuxParser::User(Pid());
    return user;
    //return string();
}

// TODO: Return the age of this process (in seconds)
long int Process::UpTime() { return 0; }

// TODO: Overload the "less than" comparison operator for Process objects
// REMOVE: [[maybe_unused]] once you define the function
bool Process::operator<(Process const& a[[maybe_unused]]) const { return true; }