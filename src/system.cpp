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

Processor& System::Cpu() { return cpu_; }

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
        // emplace_back() is more efficent than push_back()
        processes_.emplace_back(process);
    }

    // sort the processes according to cpu utilization
    std::sort(processes_.begin(), processes_.end());

    return processes_;
}

std::string System::Kernel() { 
    return LinuxParser::Kernel();
}

float System::MemoryUtilization() { 
    return LinuxParser::MemoryUtilization();
}

std::string System::OperatingSystem() { 
    return LinuxParser::OperatingSystem(); 
}

int System::RunningProcesses() { 
    return LinuxParser::RunningProcesses();
}

int System::TotalProcesses() { 
    return LinuxParser::TotalProcesses();
}

long int System::UpTime() { 
    return LinuxParser::UpTime();
}