#include <dirent.h>
#include <unistd.h>
#include <string>
#include <vector>
#include <iostream>

#include "linux_parser.h"

using std::stof;
using std::string;
using std::to_string;
using std::vector;

// DONE: An example of how to read data from the filesystem
string LinuxParser::OperatingSystem() {
  string line;
  string key;
  string value;
  std::ifstream filestream(kOSPath);
  if (filestream.is_open()) {
    while (std::getline(filestream, line)) {
      std::replace(line.begin(), line.end(), ' ', '_');
      std::replace(line.begin(), line.end(), '=', ' ');
      std::replace(line.begin(), line.end(), '"', ' ');
      std::istringstream linestream(line);
      while (linestream >> key >> value) {
        if (key == "PRETTY_NAME") {
          std::replace(value.begin(), value.end(), '_', ' ');
          return value;
        }
      }
    }
  }
  return value;
}

// DONE: An example of how to read data from the filesystem
string LinuxParser::Kernel() {
  // Only declare one variable per line to remain consistent with C++ Core Guideline ES 10
  string os;
  string version;
  string kernel;
  string line;
  std::ifstream stream(kProcDirectory + kVersionFilename);
  if (stream.is_open()) {
    std::getline(stream, line);
    std::istringstream linestream(line);
    linestream >> os >> version >> kernel;
  }
  return kernel;
}

// BONUS: Update this to use std::filesystem
vector<int> LinuxParser::Pids() {
  vector<int> pids;
  DIR* directory = opendir(kProcDirectory.c_str());
  struct dirent* file;
  while ((file = readdir(directory)) != nullptr) {
    // Is this a directory?
    if (file->d_type == DT_DIR) {
      // Is every character of the name a digit?
      string filename(file->d_name);
      if (std::all_of(filename.begin(), filename.end(), isdigit)) {
        int pid = stoi(filename);
        pids.push_back(pid);
      }
    }
  }
  closedir(directory);
  return pids;
}

// Linux stores memory utilization for the process in proc/[pid]/status
float LinuxParser::MemoryUtilization() { 
  string line;
  string key;
  string valueMemTotal;
  string valueMemFree;
  std::ifstream stream(kProcDirectory + kMeminfoFilename);
  if (stream.is_open()) {
    std::getline(stream, line);
    std::istringstream linestream(line);
    linestream >> key >> valueMemTotal;

    std::getline(stream, line);
    std::istringstream linestream2(line);
    linestream2 >> key >> valueMemFree;

    // Memory utilization = (MemTotal - MemFree) / MemTotal
    return (std::stof(valueMemTotal) - std::stof(valueMemFree)) / std::stof(valueMemTotal);
  }
  return 0.0;
}

long LinuxParser::UpTime() {
  string line;
  string seconds_up = "0";
  std::ifstream inputfilestream(kProcDirectory + kUptimeFilename);
  if (inputfilestream.is_open()) {
    std::getline(inputfilestream, line);
    std::istringstream inputstringstream(line);
    inputstringstream >> seconds_up;
  }
  return stol(seconds_up);
}

long LinuxParser::Jiffies() { 
  return ActiveJiffies() + IdleJiffies();
}

long LinuxParser::ActiveJiffies(int pid) { 
  string line, field;
  int const index_utime = 14;
  int const index_stime = 15;
  int const index_cutime = 16;
  int const index_cstime = 17;
  long utime{0};
  long stime{0};
  long cutime{0};
  long cstime{0};
  std::ifstream inputfilestream(kProcDirectory + std::to_string(pid) + kStatFilename);
  if (inputfilestream.is_open()) {
    std::getline(inputfilestream, line);
    std::istringstream inputstringstream(line);
    // have to pull the fields starting from beginning: 1, 2, 3, ... etc.
    for (int i = 1; i <= index_cstime; i++) {
      inputstringstream >> field;
      switch (i) {
        case index_utime:
          utime = stol(field);
          break;
        case index_stime:
          stime = stol(field);
          break;
        case index_cutime:
          cutime = stol(field);
          break;
        case index_cstime:
          cstime = stol(field);
          break;
        default:
          break;
      }
    }
  } 
  return utime + stime + cutime + cstime;
}

long LinuxParser::ActiveJiffies() { 
  // kUser_ + kNice_ + kSystem_ + kIRQ_ + kSoftIRQ_ + kSteal_
  // It's inefficient calling CpuUtilization() here and also in IdleJiffies(). 
  // Maybe this is the wrong approach, or there's a better approach at least?
  // Comment from reviewer: would be detrimental to code-readability if CPuUtilization() is called
  // just once.
  vector<string> allJiffies = CpuUtilization();
  return std::stol(allJiffies[kUser_]) + std::stol(allJiffies[kNice_]) + std::stol(allJiffies[kIRQ_]) + std::stol(allJiffies[kSoftIRQ_]) + std::stol(allJiffies[kSteal_]);
}

long LinuxParser::IdleJiffies() { 
  // kIdle_ + kIOwait_
  vector<string> allJiffies = CpuUtilization();
  return std::stol(allJiffies[kIdle_]) + std::stol(allJiffies[kIOwait_]);
}

vector<string> LinuxParser::CpuUtilization() { 
  string line;
  string key;
  vector<string> string_vector;
  std::ifstream inputfilestream(kProcDirectory + kStatFilename);  
  if (inputfilestream.is_open()) {
    std::getline(inputfilestream, line);
    std::istringstream inputstringstream(line);
    while (inputstringstream >> key) {
      // we don't want the sub-string "cpu"
      if (key != "cpu") {
        string_vector.push_back(key);
      }
    }
  }
  return string_vector; 
}

int LinuxParser::TotalProcesses() {
  string line;
  string key;
  string number_processes = "0";
  std::ifstream inputfilestream(kProcDirectory + kStatFilename);
  if (inputfilestream.is_open()) {
    while (std::getline(inputfilestream, line)) {
      std::istringstream linestream(line);
      linestream >> key;
      if (key == "processes") {
        linestream >> number_processes;
      }
    }
  }
  return std::stoi(number_processes);
}

int LinuxParser::RunningProcesses() { 
  string line;
  string key;
  string number_processes = "0";
  std::ifstream inputfilestream(kProcDirectory + kStatFilename);
  if (inputfilestream.is_open()) {
    while (std::getline(inputfilestream, line)) {
      std::istringstream linestream(line);
      linestream >> key;
      if (key == "procs_running") {
        linestream >> number_processes;
      }
    }
  }
  return std::stoi(number_processes);
}

string LinuxParser::Command(int pid) { 
  string line; 
  std::ifstream inputfilestream(kProcDirectory + std::to_string(pid) + kCmdlineFilename);
  if (inputfilestream.is_open()) {
    std::getline(inputfilestream, line);
    // return the entire line
    return line;
  }
  
  return string();
}


string LinuxParser::Ram(int pid) { 
  string line;
  string key;
  string memory = "0";
  std::ifstream inputfilestream(kProcDirectory + std::to_string(pid) + kStatusFilename);
  if (inputfilestream.is_open()) {
    while (std::getline(inputfilestream, line)) {
      std::istringstream linestream(line);
      linestream >> key;
      /* Reviewer comment: use VmRSS instead of VmSize.
         VmSize gives memory usage more than the Physical RAM size!
         Because VmSize is the sum of all the virtual memory as you can see on the manpages also.
         Whereas when you use VmRSS then it gives the exact physical memory being used as a 
         part of Physical RAM. So it is recommended to replace the string VmSize with VmRSS. */
      // find line beginning with "VmRSS:"" and return the memory in kB as string
      if (key == "VmRSS:") {
        linestream >> memory;
      }
    }
  }
  return memory; 
}

string LinuxParser::Uid(int pid) { 
  string key;
  string value;
  string line;
  std::ifstream inputfilestream(kProcDirectory + std::to_string(pid) + kStatusFilename);
  if (inputfilestream.is_open()) {
    while (std::getline(inputfilestream, line)) {
      std::istringstream linestream(line);
      while (linestream >> key >> value) {
        if (key == "Uid:") {
          return value;
        }
      }
    }
  }
  return "unknown";
}

string LinuxParser::User(int pid) {
  string line;
  string user;
  string x;
  string uid_;
  string uid = Uid(pid);
  std::ifstream inputfilestream(kPasswordPath);
  if (inputfilestream.is_open()) {
    while (std::getline(inputfilestream, line)) {
      std::replace(line.begin(), line.end(), ':', ' ');
      std::istringstream linestream(line);
      while (linestream >> user >> x >> uid_) {
        if (uid_ == uid) {
            return user;
        }
      }
    }
  }
  return "unknown";
}

long LinuxParser::UpTime(int pid) { 
  // this method returns the process starttime (field no. 22 in /proc/[pid]/stat)
  string line;
  string field;
  int const index_starttime = 22;
  std::ifstream inputfilestream(kProcDirectory + std::to_string(pid) + kStatFilename);
  if (inputfilestream.is_open()) {
    std::getline(inputfilestream, line);
    std::istringstream inputstringstream(line);
    // have to pull the fields starting from beginning: 1, 2, 3, ... etc.
    for (int i = 1; i <= index_starttime; i++) {
      inputstringstream >> field;
    }
  } 
  // The value in string "field" is the starttime in clock ticks (jiffies).
  // Divide by sysconf(_SC_CLK_TCK) to get time in seconds.
  return stol(field) / sysconf(_SC_CLK_TCK);
}
