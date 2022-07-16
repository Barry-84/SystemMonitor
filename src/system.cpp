#include <unistd.h>
#include <cstddef>
#include <set>
#include <string>
#include <vector>

#include "process.h"
#include "processor.h"
#include "system.h"
#include "linux_parser.h"

#include <iostream>

using std::set;
using std::size_t;
using std::string;
using std::vector;

// TODO: Return the system's CPU
Processor& System::Cpu() { return cpu_; }

// TODO: Return a container composed of the system's processes
vector<Process>& System::Processes() { 
    processes_.clear();
    // First get the IDs of all the processes
    vector<int> processPIDs = LinuxParser::Pids();
    for (int pid : processPIDs) {
        // create a new process for every process ID
        Process process;
        // set its ID to the corresponding ID from LinuxParser
        process.setPID(pid);
        process.CalcCpuLoad();
        // push the process to the vector of processes
        processes_.push_back(process);
    }

    // sort the processes according to cpu utilization
    std::sort(processes_.begin(), processes_.end());

    return processes_;
}

// TODO: Return the system's kernel identifier (string)
std::string System::Kernel() { 
    return LinuxParser::Kernel();
}

// TODO: Return the system's memory utilization
float System::MemoryUtilization() { 
    return LinuxParser::MemoryUtilization();
}

// TODO: Return the operating system name
std::string System::OperatingSystem() { 
    return LinuxParser::OperatingSystem(); 
}

// TODO: Return the number of processes actively running on the system
int System::RunningProcesses() { 
    return LinuxParser::RunningProcesses();
}

// TODO: Return the total number of processes on the system
int System::TotalProcesses() { 
    return LinuxParser::TotalProcesses();
}

// TODO: Return the number of seconds since the system started running
long int System::UpTime() { 
    return LinuxParser::UpTime();
}