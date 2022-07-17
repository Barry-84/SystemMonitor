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

int Process::Pid() const { 
    return pid;
}

void Process::setPID(int pid_in) {
    pid = pid_in;
}

float Process::getCpuLoad() const {
    return cpu_load;
}

void Process::CalcCpuLoad() {
    // total time CPU has been busy with this process
    float process_totaltime = (float) LinuxParser::ActiveJiffies(Pid()) / (float) sysconf(_SC_CLK_TCK);  
    // start time of the process in seconds
    float process_startime = (float) LinuxParser::UpTime(Pid()); 
    // uptime of the system in seconds
    float system_uptime = (float) LinuxParser::UpTime(); 
    float process_uptime = system_uptime - process_startime;
    
    cpu_load = process_totaltime / process_uptime;
}

float Process::CpuUtilization() { 
    return cpu_load;
}

string Process::Command() { 
    string command = LinuxParser::Command(Pid());
    if (command.length() > 40) {
        return command.substr(0, 40) + "...";
    }
    return command;
}

string Process::Ram() {
    /* LinuxParser::Ram(int pid) returns this process's memory utilization in kB.
       So dividing by 2^10 = 1024 gives us MB.
    */
    long megaBytes = stol(LinuxParser::Ram(Pid())) / 1024;
    return to_string(megaBytes);
}

string Process::User() { 
    return LinuxParser::User(Pid());
}

long int Process::UpTime() { 
    // Note: "long and long int are identical" (from stackoverflow)
    // LinuxParser::UpTime(int pid) returns long and this method returns long int.
    // (system uptime) - (the time the process started after system boot) 
    return LinuxParser::UpTime() - LinuxParser::UpTime(Pid());
}

bool Process::operator<(Process const& a) const {
    return a.getCpuLoad() < this->getCpuLoad();
}